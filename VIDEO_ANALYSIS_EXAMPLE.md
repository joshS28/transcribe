# Video Content Analysis Utility

This package now includes a video content analysis utility that can analyze videos to detect:
- People (count, demographics, details)
- Activities (what people are doing)
- Location (indoor/outdoor, setting details)
- Objects (notable items in the scene)
- Scene description
- Camera angle
- Lighting conditions
- Video quality

## Usage

```javascript
const { utils } = require('@staffojo/transcribe');

const { analyzeVideoContent } = utils.video;

// Analyze a video file
const result = await analyzeVideoContent('/path/to/video.mp4', {
  intervalSeconds: 5,  // Extract frame every 5 seconds (default: 5)
  maxFrames: 6,        // Maximum frames to analyze (default: 6)
  ffmpegPath: '/usr/local/bin/ffmpeg', // Optional: specify FFmpeg path
  customPrompt: '...'  // Optional: custom analysis prompt
});

console.log(result.summary);           // Overall video summary
console.log(result.frameAnalyses);     // Individual frame analyses
console.log(result.aggregatedAnalysis); // Aggregated statistics
console.log(result.metadata);          // Processing metadata
```

## Response Format

```javascript
{
  summary: {
    summary: "Overall summary of the video content",
    totalPeopleRange: "estimated range of people",
    mainActivities: ["activity1", "activity2"],
    consistentLocation: "most common location",
    keyMoments: ["moment1", "moment2"],
    overallScene: "comprehensive description"
  },
  frameAnalyses: [
    {
      frameIndex: 0,
      timestamp: 0,
      analysis: {
        people: {
          count: 1,
          details: [...]
        },
        activities: [...],
        location: {
          type: "indoor",
          description: "...",
          specificLocation: "office"
        },
        objects: [...],
        sceneDescription: "...",
        mood: "...",
        cameraAngle: "selfie",
        lighting: "...",
        videoQuality: "..."
      },
      tokenUsage: {
        promptTokens: 1234,
        completionTokens: 567,
        totalTokens: 1801
      }
    },
    // ... more frames
  ],
  aggregatedAnalysis: {
    peopleCount: { min: 1, max: 2, average: 1.5 },
    activities: ["activity1", "activity2"],
    locations: {
      all: ["indoor", "office"],
      mostCommon: "indoor"
    },
    commonObjects: ["object1", "object2"],
    peopleDetails: [...]
  },
  metadata: {
    framesAnalyzed: 6,
    intervalSeconds: 5,
    processingTimeMs: 12345,
    tokenUsage: {
      frames: {...},
      summary: {...},
      total: {...}
    }
  }
}
```

## Integration with Existing Routes

You can combine video analysis with transcription in your routes:

```javascript
const { utils } = require('@staffojo/transcribe');
const { analyzeVideoContent } = utils.video;
const { transcribeAudio } = utils.openai;

// Analyze video and transcribe audio
const [videoAnalysis, transcription] = await Promise.all([
  analyzeVideoContent(videoPath, { maxFrames: 6 }),
  transcribeAudio(audioPath)
]);

// Combine results
const combinedResult = {
  transcription: transcription.text,
  videoAnalysis: videoAnalysis.summary,
  frameDetails: videoAnalysis.frameAnalyses
};
```

## Performance Considerations

- Frame extraction uses FFmpeg and creates temporary files
- Each frame is analyzed with GPT-4 Vision (costs apply per frame)
- Default extracts 6 frames at 5-second intervals (30 seconds of video analyzed)
- Processing time scales with number of frames
- Temporary frames are automatically cleaned up

## Options

- `intervalSeconds`: Time between frame extractions (default: 5)
- `maxFrames`: Maximum number of frames to analyze (default: 6)
- `ffmpegPath`: Path to FFmpeg executable (optional)
- `customPrompt`: Custom analysis prompt for more specific detection needs

