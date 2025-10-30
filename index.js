/**
 * Audio Transcription API - npm package entry point
 * 
 * This package provides Express middleware for transcribing audio/video files
 * using OpenAI Whisper, with sentiment analysis and summarization.
 */

const transcriptionRouter = require("./src/routes/transcribe");
const {
  isAudioFile,
  extractAudioFromVideo,
  validateFileSize,
  estimateAudioDuration,
} = require("./src/utils/audioUtils");
const {
  transcribeAudio,
  analyzeSentiment,
  generateSummary,
} = require("./src/utils/openaiUtils");
const {
  createTempPaths,
  downloadFile,
  cleanupFiles,
} = require("./src/utils/fileUtils");
const {
  extractFrames,
  analyzeVideoContent,
  aggregateFrameAnalyses,
} = require("./src/utils/videoUtils");
const {
  DEFAULT_SUMMARIZATION_PROMPT,
  configureFFmpeg,
} = require("./src/utils/config");
const { log } = require("./src/utils/logger");

/**
 * Create and configure the transcription router
 * @param {Object} options - Configuration options
 * @param {string} options.openaiApiKey - OpenAI API key (defaults to process.env.OPENAI_API_KEY)
 * @param {string} options.basePath - Base path for routes (default: '/api')
 * @param {Function} options.customLogger - Custom logger function (optional)
 * @returns {Router} Express router
 */
function createTranscriptionRouter(options = {}) {
  // Set OpenAI API key if provided
  if (options.openaiApiKey) {
    process.env.OPENAI_API_KEY = options.openaiApiKey;
  }

  // Configure custom logger if provided
  if (options.customLogger) {
    // This would require modifying logger.js to accept custom logger
    // For now, we'll use the default logger
  }

  // Configure FFmpeg
  configureFFmpeg();

  return transcriptionRouter;
}

/**
 * Create a standalone Express app with transcription routes
 * @param {Object} options - Configuration options
 * @param {string} options.openaiApiKey - OpenAI API key
 * @param {number} options.port - Port number (default: 3000)
 * @param {string} options.basePath - Base path for routes (default: '/api')
 * @returns {Object} Express app
 */
function createTranscriptionApp(options = {}) {
  const express = require("express");
  const cors = require("cors");

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Create and mount transcription router
  const router = createTranscriptionRouter(options);
  app.use(options.basePath || "/api", router);

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    });
  });

  return app;
}

// Export router factory and utilities
module.exports = {
  // Router factory
  createTranscriptionRouter,
  createTranscriptionApp,
  
  // Direct router export (lazy-loaded for backward compatibility)
  get transcriptionRouter() {
    return createTranscriptionRouter();
  },
  
  // Utility functions
  utils: {
    audio: {
      isAudioFile,
      extractAudioFromVideo,
      validateFileSize,
      estimateAudioDuration,
    },
    openai: {
      transcribeAudio,
      analyzeSentiment,
      generateSummary,
    },
    file: {
      createTempPaths,
      downloadFile,
      cleanupFiles,
    },
    video: {
      extractFrames,
      analyzeVideoContent,
      aggregateFrameAnalyses,
    },
    config: {
      DEFAULT_SUMMARIZATION_PROMPT,
      configureFFmpeg,
    },
    logger: {
      log,
    },
  },
};

