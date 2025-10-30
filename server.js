/**
 * Standalone server entry point
 * This file can be used to run the transcription API as a standalone server
 */

require("dotenv").config();
const { createTranscriptionApp } = require("./index");

const PORT = process.env.PORT || 3000;

// Create the app
const app = createTranscriptionApp({
  openaiApiKey: process.env.OPENAI_API_KEY,
  basePath: "/api",
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Transcription API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Transcription endpoint: http://localhost:${PORT}/api/transcribe`);
});

