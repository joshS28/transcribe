const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

/**
 * Default summarization prompt - can be adjusted as needed
 */
const DEFAULT_SUMMARIZATION_PROMPT = `You are a professional research analyst working for a leading market research and insights company. Your role is to analyze and summarize user video responses that have been transcribed to text.

Your task is to:
1. Provide a comprehensive, objective summary of the transcribed response
2. Identify key themes, insights, and main points expressed by the user
3. Highlight any specific feedback, concerns, or suggestions mentioned
4. Note the tone and overall sentiment of the response
5. Extract actionable insights where applicable
6. Maintain accuracy and avoid adding interpretations not present in the original text

Please provide a well-structured summary that would be valuable for research analysis, decision-making, and understanding user perspectives. The summary should be clear, concise, and professionally written while capturing the essence of the user's response.`;

/**
 * Find and configure FFmpeg path
 */
const configureFFmpeg = () => {
  const ffmpegPaths = ["/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"];
  
  const foundPath = ffmpegPaths.find((testPath) => {
    if (testPath === "ffmpeg") {
      // Check if ffmpeg is in PATH
      try {
        const { execSync } = require("child_process");
        execSync("which ffmpeg", { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }
    return fs.existsSync(testPath);
  });

  const ffmpegPath = foundPath === "ffmpeg" ? "ffmpeg" : foundPath || null;

  if (ffmpegPath) {
    if (ffmpegPath !== "ffmpeg") {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    console.log(`✓ FFmpeg found at: ${ffmpegPath}`);
  } else {
    console.warn("⚠ FFmpeg not found in standard locations. Audio extraction may fail.");
  }

  return ffmpegPath;
};

module.exports = {
  DEFAULT_SUMMARIZATION_PROMPT,
  configureFFmpeg,
};




