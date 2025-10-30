/**
 * Simple logging utility for the transcription service
 */
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const prefix = `[TranscribeAudio]`;
  const logMessage = `${timestamp} ${level} ${prefix} ${message}`;

  if (level === "ERROR") {
    console.error(logMessage, data);
  } else if (level === "WARN") {
    console.warn(logMessage, data);
  } else {
    console.log(logMessage, data);
  }
};

module.exports = {
  log,
};





