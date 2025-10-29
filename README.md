# Audio Transcription API

A standalone Express.js API service for transcribing **audio and video files** from URLs using OpenAI's Whisper model, with built-in sentiment analysis and summarization capabilities.

## ✨ Quick Start

Get up and running in 3 steps:

```bash
# 1. Install dependencies
npm install

# 2. Set up your OpenAI API key
cp env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-your-key-here

# 3. Start the server
npm run dev
```

**Note:** FFmpeg is only required if you plan to transcribe **video files**. For audio-only files, FFmpeg is optional!

## Features

- 🎙️ **Audio/Video Transcription** - Transcribe audio and video files from URLs using OpenAI Whisper
- 🎭 **Sentiment Analysis** - Automatically analyze sentiment (positive, negative, neutral, mixed) with confidence scores and emotions
- 📝 **Intelligent Summarization** - Generate comprehensive summaries with customizable prompts
- 📊 **Token Usage Tracking** - Detailed tracking of OpenAI API usage and costs
- 🔍 **Comprehensive Logging** - Full request lifecycle logging for debugging and monitoring
- ✅ **Error Handling** - Robust error handling with automatic cleanup
- 🚀 **Smart File Detection** - Automatically detects audio vs video files and skips extraction when not needed

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```
- **FFmpeg** - **Only required for video files** (optional if you only need audio transcription)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [FFmpeg official website](https://ffmpeg.org/download.html)
  - **You can skip this if you're only transcribing audio files!**
- **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

## Installation

### Step 1: Clone or Download

```bash
git clone <repository-url>
cd transcribe
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
NODE_ENV=development
```

### Step 4: Verify Installation (Optional)

**For video file support**, verify FFmpeg is installed:

```bash
ffmpeg -version
```

If you see version information, you're good to go! If not, you can still use the service for audio files.

## Usage

### Starting the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

You should see:
```
🚀 Transcription API server running on port 3000
📍 Health check: http://localhost:3000/health
📍 Transcription endpoint: http://localhost:3000/api/transcribe
✓ FFmpeg found at: /usr/local/bin/ffmpeg
```

### API Endpoint

#### POST `/api/transcribe`

Transcribes an audio or video file from a URL.

**Request Body:**
```json
{
  "url": "https://example.com/audio.mp3",
  "summarizationPrompt": "Optional custom prompt for summarization"
}
```

**Parameters:**
- `url` (required, string) - The URL of the audio/video file to transcribe
- `summarizationPrompt` (optional, string) - Custom prompt for summarization. If not provided, uses a default research-focused prompt.

**Response:**
```json
{
  "url": "https://example.com/audio.mp3",
  "transcription": "The transcribed text from the audio/video...",
  "sentiment": {
    "sentiment": "positive",
    "confidence": 0.95,
    "emotions": ["satisfied", "enthusiastic"],
    "summary": "The speaker expresses positive sentiment with high confidence.",
    "error": false,
    "processingTimeMs": 345,
    "tokenUsage": {
      "promptTokens": 150,
      "completionTokens": 50,
      "totalTokens": 200
    }
  },
  "summary": "Comprehensive summary of the transcribed content...",
  "metadata": {
    "transcriptionLength": 1234,
    "wordCount": 234,
    "processingTimes": {
      "download": 1234,
      "extraction": 567,
      "transcription": 890,
      "sentiment": 345,
      "summarization": 678,
      "cleanup": 12,
      "total": 4000
    },
    "tokenUsage": {
      "whisper": {
        "note": "Whisper API pricing is per minute of audio processed, not per token",
        "estimatedDurationMinutes": 1.23,
        "audioSizeMB": 12.34
      },
      "sentiment": {
        "promptTokens": 150,
        "completionTokens": 50,
        "totalTokens": 200
      },
      "summarization": {
        "promptTokens": 500,
        "completionTokens": 300,
        "totalTokens": 800
      },
      "total": {
        "promptTokens": 650,
        "completionTokens": 350,
        "totalTokens": 1000
      }
    },
    "fileWasAudio": true
  }
}
```

### Example Requests

**Using `curl` with an audio file:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/audio.mp3"
  }'
```

**Using `curl` with a video file:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/video.webm"
  }'
```

**Using JavaScript (fetch):**
```javascript
const response = await fetch('http://localhost:3000/api/transcribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://example.com/audio.mp3',
    summarizationPrompt: 'Summarize this as a product feedback review'
  })
});

const data = await response.json();
console.log('URL:', data.url);
console.log('Transcription:', data.transcription);
console.log('Sentiment:', data.sentiment);
console.log('Summary:', data.summary);
```

### Health Check

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model to use for sentiment and summarization |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |

### Custom Summarization Prompt

You can customize the summarization behavior by:

1. **Passing a custom prompt in the request:**
```json
{
  "url": "https://example.com/audio.mp3",
  "summarizationPrompt": "You are a customer service analyst. Summarize this customer feedback focusing on pain points and suggestions."
}
```

2. **Editing the default prompt in the code:**
Edit `src/utils/config.js` and modify the `DEFAULT_SUMMARIZATION_PROMPT` constant.

## Supported File Formats

The service automatically detects file types:

- **Audio files** (direct transcription, no FFmpeg needed):
  - MP3, WAV, M4A, OGG, FLAC, WebM (audio), MP4 (audio)
  
- **Video files** (requires FFmpeg for audio extraction):
  - WebM, MP4, AVI, MOV, MKV, etc. (any format supported by FFmpeg)

- **Max file size**: 25MB (OpenAI Whisper API limit)

## How It Works

The service intelligently handles both audio and video files:

1. **Download** - Downloads the file from the provided URL
2. **Detect File Type** - Automatically detects if the file is audio or video
3. **Extract Audio** (if video) - Uses FFmpeg to extract audio track from video files
   - **Skip this step** if the file is already audio!
4. **Transcribe** - Sends audio to OpenAI Whisper API for transcription
5. **Analyze Sentiment** - Uses OpenAI GPT to analyze sentiment of transcribed text
6. **Summarize** - Uses OpenAI GPT to generate a comprehensive summary
7. **Cleanup** - Automatically removes temporary files

## Logging

The service provides comprehensive logging with:
- Request tracking with unique identifiers
- Timing information for each processing step
- Token usage tracking
- Error details with stack traces
- File size and processing metrics
- Audio vs video file detection

Logs are written to stdout with the format:
```
[TranscribeAudio] INFO Request received { url: '...', method: 'POST' }
[TranscribeAudio] INFO File is already an audio file, skipping extraction { ... }
[TranscribeAudio] INFO Transcription completed successfully { ... }
```

## Error Handling

The API handles various error scenarios:
- Invalid or missing URLs
- File download failures
- FFmpeg extraction errors (only for video files)
- OpenAI API errors
- File size limit violations (25MB max)
- Network timeouts

All errors return appropriate HTTP status codes with descriptive error messages.

## API Costs

OpenAI API pricing (as of 2024):
- **Whisper**: $0.006 per minute of audio
- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **GPT-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

The API tracks and logs all token usage for cost monitoring in the response metadata.

## Troubleshooting

### FFmpeg Not Found (for Video Files)

If you see "FFmpeg not found" errors when processing video files:

1. **Check if FFmpeg is installed:**
   ```bash
   ffmpeg -version
   ```

2. **Install FFmpeg:**
   - macOS: `brew install ffmpeg`
   - Ubuntu/Debian: `sudo apt-get install ffmpeg`
   - Windows: Download from [FFmpeg website](https://ffmpeg.org/download.html)

3. **Verify it's in your PATH:**
   ```bash
   which ffmpeg  # macOS/Linux
   where ffmpeg # Windows
   ```

**Note:** If you're only transcribing audio files, you can ignore this error - FFmpeg is not required!

### OpenAI API Key Error

Make sure your `.env` file contains a valid OpenAI API key:
```env
OPENAI_API_KEY=sk-your-actual-key-here
```

### File Too Large

OpenAI Whisper has a 25MB file size limit. If your file is larger:
- Compress the audio/video file
- Use a lower bitrate when extracting audio
- Split longer files into smaller segments

### Port Already in Use

If port 3000 is already in use, change the PORT in your `.env` file:
```env
PORT=3001
```

### Audio File Works, Video File Doesn't

If audio files work but video files fail, this means FFmpeg is not installed. Install FFmpeg using the instructions above, or stick to audio-only files if FFmpeg installation is not possible.

## Development

### Project Structure

```
transcribe/
├── src/
│   ├── index.js              # Main Express server
│   ├── routes/
│   │   └── transcribe.js     # Transcription route handler
│   └── utils/                # Utility modules
│       ├── logger.js          # Logging helper
│       ├── config.js          # Configuration (FFmpeg, prompts)
│       ├── fileUtils.js       # File operations
│       ├── audioUtils.js      # Audio detection & extraction
│       └── openaiUtils.js     # OpenAI API calls
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (not in git)
├── env.example              # Example environment file
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

### Adding Features

To extend the functionality:

1. Add new routes in `src/routes/`
2. Import and register routes in `src/index.js`
3. Create utility functions in `src/utils/` if needed
4. Update dependencies in `package.json`

## Common Use Cases

### Transcribe Audio from URL
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/interview.mp3"}'
```

### Transcribe Video from URL
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/meeting.webm"}'
```

### Custom Summary Prompt
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/feedback.mp3",
    "summarizationPrompt": "Summarize this customer feedback, highlighting the top 3 concerns and suggestions."
  }'
```

## License

MIT License - feel free to use this in your projects!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the logs for detailed error messages
- Ensure all prerequisites are installed and configured
- For audio-only use cases, FFmpeg is not required!

---

**Built with ❤️ using OpenAI Whisper and GPT models**
