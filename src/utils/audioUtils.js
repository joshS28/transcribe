const fs = require("fs");
const path = require("path");
const extractAudio = require("ffmpeg-extract-audio");
const { log } = require("./logger");

/**
 * Check if a file is already an audio file based on extension
 * OpenAI Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
 */
const isAudioFile = (filePath, contentType = null) => {
  const audioExtensions = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"];
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
  ];

  // Check by extension
  const ext = path.extname(filePath).toLowerCase();
  if (audioExtensions.includes(ext)) {
    return true;
  }

  // Check by content type
  if (contentType) {
    const normalizedContentType = contentType.toLowerCase();
    if (audioMimeTypes.some((type) => normalizedContentType.includes(type))) {
      return true;
    }
  }

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
    outputSizeMB,
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

