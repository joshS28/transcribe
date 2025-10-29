const express = require("express");
const { log } = require("../utils/logger");
const { configureFFmpeg, DEFAULT_SUMMARIZATION_PROMPT } = require("../utils/config");
const { createTempPaths, downloadFile, cleanupFiles } = require("../utils/fileUtils");
const {
  isAudioFile,
  extractAudioFromVideo,
  validateFileSize,
  estimateAudioDuration,
} = require("../utils/audioUtils");
const { transcribeAudio, analyzeSentiment, generateSummary } = require("../utils/openaiUtils");

const router = express.Router();

// Configure FFmpeg on module load
const ffmpegPath = configureFFmpeg();

/**
 * POST /api/transcribe
 * Transcribes audio/video from a URL using OpenAI Whisper
 *
 * Request body:
 *   - url (required): The URL of the audio/video file to transcribe
 *   - summarizationPrompt (optional): Custom prompt for summarization
 *
 * Response:
 *   - url: Original URL that was transcribed
 *   - transcription: The transcribed text
 *   - sentiment: Sentiment analysis results with all supporting info
 *   - summary: Summary of the transcribed content
 *   - metadata: Processing times and token usage
 */
router.post("/transcribe", async (req, res) => {
  const startTime = Date.now();
  let tempInputPath = null;
  let tempOutputPath = null;
  const originalUrl = req.body?.url;

  try {
    const { url, summarizationPrompt } = req.body;

    log("INFO", "Request received", {
      url,
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
      },
    });

    // Validate URL
    if (!url || typeof url !== "string") {
      log("WARN", "Invalid request: URL missing or invalid", { url, body: req.body });
      return res.status(400).json({
        error: "URL is required and must be a string",
      });
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      log("ERROR", "OpenAI API key not configured");
      return res.status(500).json({
        error: "Server configuration error: OpenAI API key not set",
      });
    }

    log("INFO", "Starting transcription process", {
      url,
      ffmpegPath,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Create temporary file paths
    const { inputPath, outputPath } = createTempPaths();
    tempInputPath = inputPath;
    tempOutputPath = outputPath;

    log("INFO", "Created temporary file paths", {
      tempInputPath,
      tempOutputPath,
    });

    // Step 2: Download the file
    const { downloadTime, sizeBytes: inputSizeBytes, sizeMB: inputSizeMB, contentType } = await downloadFile(
      url,
      tempInputPath
    );

    // Step 3: Check if file is already audio or needs extraction
    const fileIsAudio = isAudioFile(tempInputPath, contentType);
    let extractionTime = 0;
    let outputSizeMB = inputSizeMB;
    let audioFilePath = tempInputPath; // Use downloaded file directly if it's audio

    if (fileIsAudio) {
      log("INFO", "File is already an audio file, skipping extraction", {
        filePath: tempInputPath,
        contentType,
        sizeMB: inputSizeMB.toFixed(2),
      });
      // Validate the audio file directly and get size info
      const validationResult = validateFileSize(tempInputPath);
      outputSizeMB = validationResult.sizeMB;
      audioFilePath = tempInputPath; // Use downloaded file directly
    } else {
      // File is a video, needs extraction
      if (!ffmpegPath) {
        log("ERROR", "FFmpeg not configured", { ffmpegPath });
        throw new Error(
          "FFmpeg is not installed or not found. Please install ffmpeg (brew install ffmpeg on macOS, apt-get install ffmpeg on Linux) and ensure it's in your PATH."
        );
      }

      log("INFO", "File appears to be a video, extracting audio", {
        filePath: tempInputPath,
        contentType,
      });

      const extractionResult = await extractAudioFromVideo(tempInputPath, tempOutputPath, ffmpegPath);
      extractionTime = extractionResult.extractionTime;
      outputSizeMB = extractionResult.outputSizeMB;
      audioFilePath = tempOutputPath; // Use extracted audio file

      // Validate the extracted audio file (size already validated in extractionResult)
    }

    // Step 4: Transcribe using OpenAI Whisper
    const transcriptionResult = await transcribeAudio(audioFilePath);
    const audioDurationMinutes = estimateAudioDuration(outputSizeMB);

    // Step 5: Analyze sentiment
    const sentimentResult = await analyzeSentiment(transcriptionResult.text);

    // Step 6: Generate summary
    const summaryResult = await generateSummary(transcriptionResult.text, summarizationPrompt);

    // Step 7: Clean up temporary files
    const cleanupStartTime = Date.now();
    // Only clean up tempOutputPath if we actually created it (i.e., if we did extraction)
    const filesToCleanup = fileIsAudio ? [tempInputPath] : [tempInputPath, tempOutputPath];
    const cleanedFiles = cleanupFiles(filesToCleanup);
    const cleanupTime = Date.now() - cleanupStartTime;

    log("INFO", "Temporary files cleaned up", {
      cleanedFiles: cleanedFiles.map((f) => ({
        path: f.path,
        cleaned: f.cleaned,
      })),
      cleanupTimeMs: cleanupTime,
    });

    // Calculate totals
    const totalTime = Date.now() - startTime;
    const totalTokenUsage = {
      sentiment: sentimentResult.tokenUsage,
      summarization: summaryResult.tokenUsage,
      total: {
        promptTokens: sentimentResult.tokenUsage.promptTokens + summaryResult.tokenUsage.promptTokens,
        completionTokens: sentimentResult.tokenUsage.completionTokens + summaryResult.tokenUsage.completionTokens,
        totalTokens: sentimentResult.tokenUsage.totalTokens + summaryResult.tokenUsage.totalTokens,
      },
    };

    log("INFO", "Request completed successfully", {
      totalTimeMs: totalTime,
      downloadTimeMs: downloadTime,
      extractionTimeMs: extractionTime,
      transcriptionTimeMs: transcriptionResult.processingTime,
      sentimentTimeMs: sentimentResult.processingTime,
      summarizationTimeMs: summaryResult.processingTime,
      cleanupTimeMs: cleanupTime,
      transcriptionLength: transcriptionResult.length,
      wordCount: transcriptionResult.wordCount,
      url: originalUrl,
      fileWasAudio: fileIsAudio,
      tokenUsage: {
        whisper: {
          note: "Whisper API is priced per minute of audio, not per token",
          estimatedDurationMinutes: audioDurationMinutes,
          audioSizeMB: outputSizeMB.toFixed(2),
        },
        sentiment: sentimentResult.tokenUsage,
        summarization: summaryResult.tokenUsage,
        total: totalTokenUsage.total,
      },
    });

    // Build response with all required fields
    return res.status(200).json({
      url: originalUrl,
      transcription: transcriptionResult.text,
      sentiment: {
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        emotions: sentimentResult.emotions,
        summary: sentimentResult.summary,
        error: sentimentResult.error || false,
        // Include supporting info from logs
        processingTimeMs: sentimentResult.processingTime,
        tokenUsage: sentimentResult.tokenUsage,
      },
      summary: summaryResult.summary,
      metadata: {
        transcriptionLength: transcriptionResult.length,
        wordCount: transcriptionResult.wordCount,
        processingTimes: {
          download: downloadTime,
          extraction: extractionTime,
          transcription: transcriptionResult.processingTime,
          sentiment: sentimentResult.processingTime,
          summarization: summaryResult.processingTime,
          cleanup: cleanupTime,
          total: totalTime,
        },
        tokenUsage: {
          whisper: {
            note: "Whisper API pricing is per minute of audio processed, not per token",
            estimatedDurationMinutes: parseFloat(audioDurationMinutes),
            audioSizeMB: parseFloat(outputSizeMB.toFixed(2)),
          },
          sentiment: sentimentResult.tokenUsage,
          summarization: summaryResult.tokenUsage,
          total: totalTokenUsage.total,
        },
        fileWasAudio: fileIsAudio,
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      url: originalUrl,
      tempInputPath,
      tempOutputPath,
      ffmpegPath,
      totalTimeMs: totalTime,
      errorType: error.constructor.name,
    };

    log("ERROR", "Error in transcription route", errorDetails);

    // Clean up temporary files in case of error
    try {
      const filesToCleanup = [tempInputPath, tempOutputPath].filter(Boolean);
      const cleanedFiles = cleanupFiles(filesToCleanup);
      if (cleanedFiles.length > 0) {
        log("INFO", "Temporary files cleaned up after error", {
          cleanedFiles: cleanedFiles.map((f) => ({
            path: f.path,
            cleaned: f.cleaned,
          })),
        });
      }
    } catch (cleanupError) {
      log("ERROR", "Error cleaning up temp files after error", {
        message: cleanupError.message,
        stack: cleanupError.stack,
        tempInputPath,
        tempOutputPath,
      });
    }

    const errorMessage = error.message || "Unknown error occurred";
    return res.status(500).json({
      error: "Failed to transcribe audio",
      message: errorMessage,
      url: originalUrl,
    });
  }
});

module.exports = router;
