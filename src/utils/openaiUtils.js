const OpenAI = require("openai");
const fs = require("fs");
const { log } = require("./logger");
const { DEFAULT_SUMMARIZATION_PROMPT } = require("./config");

// Lazy-load OpenAI client to support dynamic API key configuration
let openaiClient = null;

/**
 * Get or create OpenAI client instance
 * This allows the API key to be set dynamically via process.env
 */
const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Please set it in your environment or pass it to createTranscriptionRouter.");
    }
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  return openaiClient;
};

/**
 * Transcribe audio file using OpenAI Whisper
 */
const transcribeAudio = async (audioFilePath) => {
  const startTime = Date.now();

  log("INFO", "Starting Whisper transcription", {
    model: "whisper-1",
  });

  const openai = getOpenAIClient();
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
  });

  const transcriptionTime = Date.now() - startTime;
  const transcriptionText = transcription.text || "";
  const transcriptionLength = transcriptionText.length;
  const wordCount = transcriptionText.split(/\s+/).filter((w) => w.length > 0).length;

  log("INFO", "Transcription completed successfully", {
    transcription: transcriptionText,
    transcriptionLength,
    wordCount,
    transcriptionTimeMs: transcriptionTime,
    model: "whisper-1",
  });

  return {
    text: transcriptionText,
    length: transcriptionLength,
    wordCount,
    processingTime: transcriptionTime,
  };
};

/**
 * Analyze sentiment of text using OpenAI
 */
const analyzeSentiment = async (text) => {
  const startTime = Date.now();

  log("INFO", "Starting sentiment analysis");

  const messages = [
    {
      role: "system",
      content:
        "You are a sentiment analysis expert. Analyze the following text and provide a JSON response with the following structure: {\"sentiment\": \"positive\" | \"negative\" | \"neutral\" | \"mixed\", \"confidence\": 0.0-1.0, \"emotions\": [\"emotion1\", \"emotion2\"], \"summary\": \"brief explanation of the sentiment\"}. Be accurate and objective.",
    },
    {
      role: "user",
      content: `Analyze the sentiment of this transcribed text:\n\n${text}`,
    },
  ];

  let result = {
    sentiment: null,
    confidence: null,
    emotions: [],
    summary: null,
    processingTime: 0,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    error: false,
  };

  try {
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await openai.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    result.processingTime = Date.now() - startTime;
    const sentimentData = JSON.parse(response.choices[0].message.content);
    
    result = {
      ...sentimentData,
      processingTime: result.processingTime,
      tokenUsage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };

    log("INFO", "Sentiment analysis completed", {
      sentiment: result,
      processingTimeMs: result.processingTime,
      model,
      tokenUsage: result.tokenUsage,
    });
  } catch (error) {
    result.processingTime = Date.now() - startTime;
    result.error = true;
    result.sentiment = "neutral";
    result.confidence = 0;
    result.emotions = [];
    result.summary = "Sentiment analysis could not be completed";

    log("ERROR", "Sentiment analysis failed", {
      message: error.message,
      stack: error.stack,
      tokenUsage: result.tokenUsage,
    });
  }

  return result;
};

/**
 * Generate summary of text using OpenAI
 */
const generateSummary = async (text, customPrompt = null) => {
  const startTime = Date.now();

  const promptToUse = customPrompt || DEFAULT_SUMMARIZATION_PROMPT;

  log("INFO", "Starting summarization", {
    usingCustomPrompt: !!customPrompt,
    promptLength: promptToUse.length,
  });

  const messages = [
    {
      role: "system",
      content: promptToUse,
    },
    {
      role: "user",
      content: `Please analyze and summarize the following transcribed video response:\n\n${text}`,
    },
  ];

  let result = {
    summary: "",
    processingTime: 0,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    error: false,
  };

  try {
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 1500,
    });

    result.processingTime = Date.now() - startTime;
    result.summary = response.choices[0].message.content.trim();
    result.tokenUsage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };

    log("INFO", "Summarization completed", {
      summaryLength: result.summary.length,
      processingTimeMs: result.processingTime,
      model,
      tokenUsage: result.tokenUsage,
      summary: result.summary,
    });
  } catch (error) {
    result.processingTime = Date.now() - startTime;
    result.error = true;
    result.summary = "Summarization could not be completed due to an error.";

    log("ERROR", "Summarization failed", {
      message: error.message,
      stack: error.stack,
      tokenUsage: result.tokenUsage,
    });
  }

  return result;
};

module.exports = {
  getOpenAIClient,
  transcribeAudio,
  analyzeSentiment,
  generateSummary,
};

