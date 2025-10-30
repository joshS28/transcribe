const fs = require("fs");
const path = require("path");
const os = require("os");
const { promisify } = require("util");
const ffmpeg = require("fluent-ffmpeg");
const { log } = require("./logger");

/**
 * Extract frames from video at specified intervals
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Directory to save frames
 * @param {Object} options - Extraction options
 * @param {number} options.intervalSeconds - Extract frame every N seconds (default: 5)
 * @param {number} options.maxFrames - Maximum number of frames to extract (default: 10)
 * @param {string} options.ffmpegPath - FFmpeg path (optional)
 * @returns {Promise<Array<string>>} Array of frame file paths
 */
const extractFrames = async (videoPath, outputDir, options = {}) => {
  const startTime = Date.now();
  const { intervalSeconds = 5, maxFrames = 10, ffmpegPath } = options;

  log("INFO", "Extracting frames from video", {
    videoPath,
    outputDir,
    intervalSeconds,
    maxFrames,
  });

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get video duration first
  const videoDuration = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      // Ensure numeric duration to avoid toFixed errors; try multiple sources
      const formatDuration = Number(metadata?.format?.duration);
      const streamDuration = Number(
        Array.isArray(metadata?.streams)
          ? metadata.streams.find((s) => s.codec_type === "video")?.duration
          : undefined
      );
      const parsed = Number.isFinite(formatDuration)
        ? formatDuration
        : Number.isFinite(streamDuration)
        ? streamDuration
        : 0;
      resolve(parsed || 0);
    });
  });

  const hasDuration = Number.isFinite(videoDuration) && videoDuration > 0;

  log("INFO", "Video duration retrieved", {
    videoDuration: hasDuration ? videoDuration.toFixed(2) : "0.00",
    totalPossibleFrames: hasDuration
      ? Math.ceil(videoDuration / intervalSeconds)
      : 1,
  });

  // Calculate frame extraction points
  const framePaths = [];
  let frameCount = 0;
  if (hasDuration) {
    frameCount = Math.min(maxFrames, Math.max(0, Math.ceil(videoDuration / intervalSeconds)));
  } else {
    // Fallback: try to extract one frame at t=0 when duration is unknown/zero
    frameCount = 1;
  }

  // Extract frames
  const extractPromises = [];
  for (let i = 0; i < frameCount; i++) {
    const timestamp = hasDuration ? i * intervalSeconds : 0;

    if (hasDuration && timestamp >= videoDuration) break;

    const framePath = path.join(outputDir, `frame_${i}_${timestamp.toFixed(1)}s.jpg`);
    framePaths.push(framePath);

    const extractPromise = new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath);
      
      if (ffmpegPath) {
        command.setFfmpegPath(ffmpegPath);
      }

      command
        .seekInput(timestamp)
        .frames(1)
        .output(framePath)
        .outputOptions(["-q:v", "2"]) // High quality JPEG
        .on("end", () => {
          log("INFO", "Frame extracted", { framePath, timestamp });
          resolve(framePath);
        })
        .on("error", (err) => {
          log("ERROR", "Frame extraction error", { framePath, timestamp, error: err.message });
          reject(err);
        })
        .run();
    });

    extractPromises.push(extractPromise);
  }

  await Promise.all(extractPromises);

  const extractionTime = Date.now() - startTime;
  log("INFO", "Piece extraction completed", {
    framesExtracted: framePaths.length,
    extractionTimeMs: extractionTime,
  });

  return framePaths;
};

/**
 * Convert image file to base64
 * @param {string} imagePath - Path to image file
 * @returns {string} Base64 encoded image
 */
const imageToBase64 = (imagePath) => {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString("base64");
};

/**
 * Analyze video content using OpenAI Vision API
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Analysis options
 * @param {number} options.intervalSeconds - Extract frame every N seconds (default: 5)
 * @param {number} options.maxFrames - Maximum number of frames to analyze (default: 6)
 * @param {string} options.ffmpegPath - FFmpeg path (optional)
 * @param {string} options.customPrompt - Custom analysis prompt (optional)
 * @returns {Promise<Object>} Analysis results
 */
const analyzeVideoContent = async (videoPath, options = {}) => {
  const startTime = Date.now();
  const { intervalSeconds = 5, maxFrames = 6, ffmpegPath, customPrompt } = options;

  log("INFO", "Starting video content analysis", {
    videoPath,
    intervalSeconds,
    maxFrames,
  });

  // Create temporary directory for frames
  const tempDir = path.join(os.tmpdir(), `video-frames-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Step 1: Extract frames from video
    const framePaths = await extractFrames(videoPath, tempDir, {
      intervalSeconds,
      maxFrames,
      ffmpegPath,
    });

    if (framePaths.length === 0) {
      log("ERROR", "No frames were extracted; skipping vision analysis", {});
      const analysisTime = Date.now() - startTime;
      return {
        summary: null,
        frameAnalyses: [],
        aggregatedAnalysis: aggregateFrameAnalyses([]),
        metadata: {
          framesAnalyzed: 0,
          intervalSeconds,
          processingTimeMs: analysisTime,
          tokenUsage: {
            frames: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            summary: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            total: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
        },
      };
    }

    log("INFO", "Analyzing extracted frames with OpenAI Vision", {
      frameCount: framePaths.length,
    });

    // Step 2: Analyze frames with OpenAI Vision API
    const defaultPrompt = customPrompt || `Analyze this video frame and provide a detailed JSON response with the following structure:
{
  "people": {
    "count": number of people visible,
    "details": [array of person descriptions with demographics if visible]
  },
  "activities": [array of what people or objects are doing],
  "location": {
    "type": "indoor/outdoor/vehicle/etc",
    "description": "detailed description of the setting/environment",
    "specificLocation": "if recognizable (office, home, park, etc)"
  },
  "objects": [array of notable objects, furniture, equipment, etc],
  "sceneDescription": "comprehensive description of what's happening in the frame",
  "mood": "description of the atmosphere/mood",
  "cameraAngle": "description of camera perspective (selfie, side, front, etc)",
  "lighting": "description of lighting conditions",
  "videoQuality": "assessment of video quality/clarity"
}`;

    // Import OpenAI client getter
    const { getOpenAIClient } = require("./openaiUtils");
    const openaiClient = getOpenAIClient();

    // Analyze each frame
    const frameAnalyses = [];
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const timestamp = i * intervalSeconds;

      try {
        const base64Image = imageToBase64(framePath);
        const imageSize = fs.statSync(framePath).size;

        log("INFO", "Analyzing frame with OpenAI Vision", {
          frameIndex: i,
          framePath,
          timestamp,
          imageSizeBytes: imageSize,
        });

        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o", // GPT-4 Vision model
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: defaultPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysis = JSON.parse(response.choices[0].message.content);
        frameAnalyses.push({
          frameIndex: i,
          timestamp,
          analysis,
          tokenUsage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          },
        });

        log("INFO", "Frame analysis completed", {
          frameIndex: i,
          timestamp,
          tokenUsage: frameAnalyses[frameAnalyses.length - 1].tokenUsage,
        });
      } catch (frameError) {
        log("ERROR", "Error analyzing frame", {
          frameIndex: i,
          framePath,
          timestamp,
          error: frameError.message,
        });
        // Continue with other frames even if one fails
      }
    }

    // Step 3: Aggregate analysis from all frames
    const aggregatedAnalysis = aggregateFrameAnalyses(frameAnalyses);

    // Step 4: Generate comprehensive summary using GPT
    const summaryPrompt = `Based on the following video frame analyses, provide a comprehensive summary of the entire video:

${frameAnalyses.map((fa, idx) => 
  `Frame ${idx + 1} (at ${fa.timestamp}s): ${JSON.stringify(fa.analysis)}`
).join('\n\n')}

Provide a JSON response with:
{
  "summary": "overall summary of the video content",
  "totalPeopleRange": "estimated range of people across the video",
  "mainActivities": [array of primary activities throughout the video],
  "consistentLocation": "most common location/setting",
  "videoDuration": "estimated or actual duration if available",
  "keyMoments": [array of notable moments/scenes],
  "overallScene": "comprehensive description of what the video shows"
}`;

    let videoSummary = null;
    let summaryTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    try {
      const summaryResponse = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: summaryPrompt,
          },
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      videoSummary = JSON.parse(summaryResponse.choices[0].message.content);
      summaryTokenUsage = {
        promptTokens: summaryResponse.usage.prompt_tokens,
        completionTokens: summaryResponse.usage.completion_tokens,
        totalTokens: summaryResponse.usage.total_tokens,
      };
    } catch (summaryError) {
      log("ERROR", "Error generating video summary", {
        error: summaryError.message,
      });
    }

    const analysisTime = Date.now() - startTime;
    const totalTokenUsage = {
      frames: frameAnalyses.reduce(
        (sum, fa) => ({
          promptTokens: sum.promptTokens + fa.tokenUsage.promptTokens,
          completionTokens: sum.completionTokens + fa.tokenUsage.completionTokens,
          totalTokens: sum.totalTokens + fa.tokenUsage.totalTokens,
        }),
        { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      ),
      summary: summaryTokenUsage,
      total: {
        promptTokens: frameAnalyses.reduce((s, fa) => s + fa.tokenUsage.promptTokens, 0) + summaryTokenUsage.promptTokens,
        completionTokens: frameAnalyses.reduce((s, fa) => s + fa.tokenUsage.completionTokens, 0) + summaryTokenUsage.completionTokens,
        totalTokens: frameAnalyses.reduce((s, fa) => s + fa.tokenUsage.totalTokens, 0) + summaryTokenUsage.totalTokens,
      },
    };

    log("INFO", "Video content analysis completed", {
      framesAnalyzed: frameAnalyses.length,
      analysisTimeMs: analysisTime,
      tokenUsage: totalTokenUsage,
    });

    return {
      summary: videoSummary,
      frameAnalyses,
      aggregatedAnalysis,
      metadata: {
        framesAnalyzed: frameAnalyses.length,
        intervalSeconds,
        processingTimeMs: analysisTime,
        tokenUsage: totalTokenUsage,
      },
    };
  } finally {
    // Clean up temporary frames directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
        log("INFO", "Temporary frames directory cleaned up", { tempDir });
      }
    } catch (cleanupError) {
      log("ERROR", "Error cleaning up frames directory", {
        tempDir,
        error: cleanupError.message,
      });
    }
  }
};

/**
 * Aggregate analyses from multiple frames into a comprehensive result
 * @param {Array<Object>} frameAnalyses - Array of frame analysis results
 * @returns {Object} Aggregated analysis
 */
const aggregateFrameAnalyses = (frameAnalyses) => {
  if (frameAnalyses.length === 0) {
    return {
      peopleCount: { min: 0, max: 0, average: 0 },
      activities: [],
      locations: [],
      commonObjects: [],
    };
  }

  const peopleCounts = frameAnalyses
    .map((fa) => fa.analysis?.people?.count || 0)
    .filter((count) => count !== null && count !== undefined);

  const allActivities = new Set();
  const allLocations = [];
  const allObjects = new Set();
  const allPeopleDetails = [];

  frameAnalyses.forEach((fa) => {
    const analysis = fa.analysis || {};
    
    // Collect activities
    if (Array.isArray(analysis.activities)) {
      analysis.activities.forEach((act) => allActivities.add(act));
    }

    // Collect locations
    if (analysis.location) {
      allLocations.push(analysis.location.type || analysis.location.description);
    }

    // Collect objects
    if (Array.isArray(analysis.objects)) {
      analysis.objects.forEach((obj) => allObjects.add(obj));
    }

    // Collect people details
    if (Array.isArray(analysis.people?.details)) {
      allPeopleDetails.push(...analysis.people.details);
    }
  });

  // Find most common location
  const locationFrequency = {};
  allLocations.forEach((loc) => {
    locationFrequency[loc] = (locationFrequency[loc] || 0) + 1;
  });
  const mostCommonLocation = Object.keys(locationFrequency).reduce((a, b) =>
    locationFrequency[a] > locationFrequency[b] ? a : b,
    "unknown"
  );

  return {
    peopleCount: {
      min: Math.min(...peopleCounts),
      max: Math.max(...peopleCounts),
      average: peopleCounts.reduce((a, b) => a + b, 0) / peopleCounts.length,
    },
    activities: Array.from(allActivities),
    locations: {
      all: Array.from(new Set(allLocations)),
      mostCommon: mostCommonLocation,
    },
    commonObjects: Array.from(allObjects),
    peopleDetails: allPeopleDetails,
  };
};

module.exports = {
  extractFrames,
  imageToBase64,
  analyzeVideoContent,
  aggregateFrameAnalyses,
};

