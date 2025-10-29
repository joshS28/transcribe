const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { log } = require("./logger");

/**
 * Create temporary file paths for processing
 */
const createTempPaths = () => {
  const tempDir = os.tmpdir();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const inputPath = path.join(tempDir, `input-${uniqueId}.webm`);
  const outputPath = path.join(tempDir, `output-${uniqueId}.mp3`);

  return { tempDir, uniqueId, inputPath, outputPath };
};

/**
 * Download a file from URL to a local path
 * Returns file info including content type
 */
const downloadFile = async (url, outputPath) => {
  const startTime = Date.now();

  log("INFO", "Downloading file from URL", {
    url,
    outputPath,
    timeout: 300000,
  });

  const response = await axios({
    method: "get",
    url,
    responseType: "stream",
    timeout: 300000, // 5 minute timeout
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  const downloadTime = Date.now() - startTime;
  const stats = fs.statSync(outputPath);
  const sizeInMB = stats.size / (1024 * 1024);
  const contentType = response.headers["content-type"] || null;

  log("INFO", "File downloaded successfully", {
    outputPath,
    downloadTimeMs: downloadTime,
    sizeBytes: stats.size,
    sizeMB: sizeInMB.toFixed(2),
    contentType,
    contentLength: response.headers["content-length"],
  });

  return {
    downloadTime,
    sizeBytes: stats.size,
    sizeMB: sizeInMB,
    stats,
    contentType,
  };
};

/**
 * Clean up temporary files
 */
const cleanupFiles = (filePaths) => {
  const cleanedFiles = [];

  for (const filePath of filePaths) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        cleanedFiles.push({
          path: filePath,
          sizeBytes: stats.size,
          cleaned: true,
        });
      } catch (error) {
        cleanedFiles.push({
          path: filePath,
          cleaned: false,
          error: error.message,
        });
      }
    }
  }

  return cleanedFiles;
};

module.exports = {
  createTempPaths,
  downloadFile,
  cleanupFiles,
};

