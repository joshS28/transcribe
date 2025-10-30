const fs = require("fs");
const path = require("path");
const extractAudio = require("ffmpeg-extract-audio");
const { log } = require("./logger");

/**
 * Check if a file is already an audio file based on extension and content type
 * OpenAI Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
 * 
 * Note: Some extensions like .webm and .mp4 can be either audio or video.
 * We prioritize content type detection over extension.
 */
const isAudioFile = (filePath, contentType = null) => {
  // Pure audio-only extensions (never contain video)
  const audioOnlyExtensions = [".mp3", ".mpga", ".m4a", ".wav", ".ogg", ".flac", ".aac"];
  
  // Ambiguous extensions that can be audio OR video
  const ambiguousExtensions = [".mp4", ".mpeg", ".webm"];
  
  // Audio MIME types
  const audioMimeTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/flac",
    "audio/x-m4a",
    "audio/aac",
  ];
  
  // Video MIME types (definitely not audio-only)
  const videoMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv
    "video/3gpp",
    "video/x-flv",
  ];

  const ext = path.extname(filePath).toLowerCase();
  const normalizedContentType = contentType ? contentType.toLowerCase() : null;

  // If we have a content type, check it first (most reliable)
  if (normalizedContentType) {
    // If content type is explicitly video, it's NOT an audio-only file
    if (videoMimeTypes.some((type) => normalizedContentType.includes(type))) {
      log("INFO", "File detected as video via content type", {
        filePath,
        contentType: normalizedContentType,
      });
      return false;
    }
    
    // If content type is explicitly audio, it IS an audio-only file
    if (audioMimeTypes.some((type) => normalizedContentType.includes(type))) {
      log("INFO", "File detected as audio via content type", {
        filePath,
        contentType: normalizedContentType,
      });
      return true;
    }
  }

  // Check by extension (only if content type didn't help)
  // Pure audio-only extensions are definitely audio
  if (audioOnlyExtensions.includes(ext)) {
    log("INFO", "File detected as audio via extension", {
      filePath,
      extension: ext,
    });
    return true;
  }
  
  // Ambiguous extensions (.webm, .mp4, .mpeg) - need content type to determine
  // If we don't have content type and it's an ambiguous extension, 
  // default to treating as video (since most .webm/.mp4 files are video)
  if (ambiguousExtensions.includes(ext)) {
    if (normalizedContentType) {
      // We already checked content type above, so if we get here,
      // content type didn't match video or audio - more conservative, treat as video
      log("INFO", "Ambiguous extension with unknown content type, treating as video", {
        filePath,
        extension: ext,
        contentType: normalizedContentType,
      });
      return false;
    } else {
      // No content type info - for ambiguous extensions, assume video
      log("INFO", "Ambiguous extension without content type, defaulting to video", {
        filePath,
        extension: ext,
      });
      return false;
    }
  }

  // Unknown extension - default to treating as video (safer)
  log("INFO", "Unknown extension, defaulting to video", {
    filePath,
    extension: ext,
    contentType: normalizedContentType,
  });
  return false;
};

/**
 * Extract audio from video file using FFmpeg
 */
const extractAudioFromVideo = async (inputPath, outputPath, ffmpegPath) => {
  const startTime = Date.now();

  log("INFO", "Extracting audio from video", {
    inputPath,
    outputPath,
    ffmpegPath,
    format: "mp3",
  });

  await extractAudio({
    input: inputPath,
    output: outputPath,
    format: "mp3",
  });

  const extractionTime = Date.now() - startTime;
  const outputStats = fs.statSync(outputPath);
  const outputSizeInMB = outputStats.size / (1024 * 1024);
  const inputStats = fs.statSync(inputPath);
  const inputSizeInMB = inputStats.size / (1024 * 1024);

  log("INFO", "Audio extracted successfully", {
    outputPath,
    extractionTimeMs: extractionTime,
    outputSizeBytes: outputStats.size,
    outputSizeMB: outputSizeInMB.toFixed(2),
    inputSizeMB: inputSizeInMB.toFixed(2),
    sizeReduction: `${((1 - outputStats.size / inputStats.size) * 100).toFixed(1)}%`,
  });

  return {
    extractionTime,
    outputSizeBytes: outputStats.size,
    outputSizeMB: outputSizeInMB,
    stats: outputStats,
  };
};

/**
 * Validate audio file size (OpenAI Whisper has 25MB limit)
 */
const validateFileSize = (filePath) => {
  const stats = fs.statSync(filePath);
  const sizeInMB = stats.size / (1024 * 1024);

  if (sizeInMB > 25) {
    log("ERROR", "Audio file too large", {
      sizeMB: sizeInMB.toFixed(2),
      limitMB: 25,
      filePath,
    });
    throw new Error(`Audio file is too large: ${sizeInMB.toFixed(2)}MB. Maximum size is 25MB.`);
  }

  log("INFO", "File size check passed", {
    sizeMB: sizeInMB.toFixed(2),
    limitMB: 25,
  });

  // Ensure we return a valid number
  const fileSizeMB = Number(sizeInMB);
  if (isNaN(fileSizeMB)) {
    throw new Error(`Invalid file size calculation: ${sizeInMB}`);
  }

  return {
    sizeBytes: stats.size,
    sizeMB: fileSizeMB,
  };
};

/**
 * Estimate audio duration from file size (rough estimate: ~10MB per minute for MP3)
 */
const estimateAudioDuration = (sizeMB) => {
  return sizeMB > 0 ? (sizeMB / 10).toFixed(2) : "unknown";
};

module.exports = {
  isAudioFile,
  extractAudioFromVideo,
  validateFileSize,
  estimateAudioDuration,
};

