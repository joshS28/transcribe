const { log } = require("./logger");

/**
 * Calculate quality score for transcription/answer (0-100)
 * Higher score = better quality, more likely to keep
 * @param {string} transcription - The transcribed text
 * @param {Object} metadata - Transcription metadata
 * @returns {Object} Quality score and breakdown
 */
const calculateAnswerQuality = (transcription, metadata = {}) => {
  if (!transcription || transcription.trim().length === 0) {
    return {
      score: 0,
      maxScore: 100,
      breakdown: {
        hasContent: 0,
        lengthScore: 0,
        wordCountScore: 0,
        meaningfulContentScore: 0,
      },
      reasons: ["No transcription content"],
    };
  }

  const text = transcription.trim();
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const charCount = text.length;

  // Score components (each out of 25 points, total 100)
  let hasContent = 0;
  let lengthScore = 0;
  let wordCountScore = 0;
  let meaningfulContentScore = 0;
  const reasons = [];

  // 1. Has content (0 or 25 points)
  if (text.length > 0) {
    hasContent = 25;
  } else {
    reasons.push("No text content");
  }

  // 2. Length score (0-25 points)
  // Good responses are typically 50-500 characters
  if (charCount >= 50 && charCount <= 500) {
    lengthScore = 25;
  } else if (charCount >= 20 && charCount < 50) {
    lengthScore = 15; // Too short but has some content
    reasons.push("Response is quite short");
  } else if (charCount > 500 && charCount <= 1000) {
    lengthScore = 20; // A bit long but acceptable
  } else if (charCount > 1000) {
    lengthScore = 15; // Very long, might be rambling
    reasons.push("Response is very long");
  } else if (charCount < 20) {
    lengthScore = 5; // Very short, likely not useful
    reasons.push("Response is too short to be meaningful");
  }

  // 3. Word count score (0-25 points)
  // Good responses have 10-100 words
  if (wordCount >= 10 && wordCount <= 100) {
    wordCountScore = 25;
  } else if (wordCount >= 5 && wordCount < 10) {
    wordCountScore = 15;
    reasons.push("Low word count");
  } else if (wordCount > 100 && wordCount <= 200) {
    wordCountScore = 20;
  } else if (wordCount > 200) {
    wordCountScore = 15;
    reasons.push("Very high word count");
  } else if (wordCount < 5) {
    wordCountScore = 5;
    reasons.push("Very few words");
  }

  // 4. Meaningful content score (0-25 points)
  // Check for common "bad" patterns
  const lowerText = text.toLowerCase();
  const fillerWords = ["um", "uh", "er", "ah", "like", "you know"];
  const fillerCount = fillerWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    return count + (text.match(regex) || []).length;
  }, 0);

  const hasQuestionMarks = (text.match(/\?/g) || []).length;
  const hasMultipleSentences = (text.match(/[.!?]\s+[A-Z]/g) || []).length > 0;
  const hasNumbers = /\d/.test(text);
  const hasVariedWords = new Set(text.toLowerCase().split(/\s+/)).size;

  let meaningfulScore = 25;

  // Deduct for excessive fillers
  if (fillerCount > wordCount * 0.2) {
    meaningfulScore -= 10;
    reasons.push("Excessive filler words");
  }

  // Deduct if it's mostly questions (might be confused user)
  if (hasQuestionMarks > wordCount * 0.3) {
    meaningfulScore -= 5;
    reasons.push("Response contains many questions");
  }

  // Bonus for varied vocabulary
  if (hasVariedWords / wordCount > 0.7 && wordCount > 10) {
    meaningfulScore += 5;
  }

  // Ensure score stays in range
  meaningfulScore = Math.max(0, Math.min(25, meaningfulScore));

  const totalScore = hasContent + lengthScore + wordCountScore + meaningfulScore;

  return {
    score: Math.round(totalScore),
    maxScore: 100,
    breakdown: {
      hasContent,
      lengthScore: Math.round(lengthScore),
      wordCountScore: Math.round(wordCountScore),
      meaningfulContentScore: Math.round(meaningfulScore),
    },
    reasons: reasons.length > 0 ? reasons : ["Good quality response"],
    metrics: {
      characterCount: charCount,
      wordCount,
      fillerWordCount: fillerCount,
      questionCount: hasQuestionMarks,
      uniqueWords: hasVariedWords,
    },
  };
};

/**
 * Calculate quality score for video (0-100)
 * Higher score = better quality, more likely to keep
 * @param {Object} videoAnalysis - Video analysis results
 * @param {boolean} fileIsAudio - Whether the file is audio only
 * @returns {Object} Quality score and breakdown
 */
const calculateVideoQuality = (videoAnalysis, fileIsAudio = false) => {
  // If it's audio only, we can't assess video quality
  if (fileIsAudio || !videoAnalysis) {
    return {
      score: 50, // Neutral score for audio-only
      maxScore: 100,
      breakdown: {
        personDetected: 0,
        speakingDetected: 0,
        videoQuality: 25,
        engagementScore: 25,
      },
      reasons: ["Audio-only file, cannot assess video quality"],
    };
  }

  const aggregated = videoAnalysis.aggregatedAnalysis || {};
  const summary = videoAnalysis.summary || {};
  const frameAnalyses = videoAnalysis.frameAnalyses || [];

  let personDetected = 0;
  let speakingDetected = 0;
  let videoQuality = 0;
  let engagementScore = 0;
  const reasons = [];

  // 1. Person detection (0-30 points)
  const peopleCount = aggregated.peopleCount || { average: 0, min: 0, max: 0 };
  const avgPeople = peopleCount.average || 0;

  if (avgPeople >= 1) {
    personDetected = 30;
    if (avgPeople === 1) {
      reasons.push("One person detected in video");
    } else {
      reasons.push(`${Math.round(avgPeople)} people detected in video`);
    }
  } else {
    personDetected = 0;
    reasons.push("No person detected in video");
  }

  // 2. Speaking detection (0-30 points)
  // Check frame analyses for speaking indicators
  let speakingFrames = 0;
  let mouthOpenFrames = 0;
  let lookingAtCameraFrames = 0;

  frameAnalyses.forEach((frame) => {
    const analysis = frame.analysis || {};
    const people = analysis.people || {};
    const activities = analysis.activities || [];

    // Check if people are speaking
    const speakingIndicators = activities.filter((act) =>
      typeof act === "string" &&
      (act.toLowerCase().includes("speaking") ||
        act.toLowerCase().includes("talking") ||
        act.toLowerCase().includes("mouth") ||
        act.toLowerCase().includes("saying"))
    );

    if (speakingIndicators.length > 0) {
      speakingFrames++;
    }

    // Check for mouth open or looking at camera
    const peopleDetails = people.details || [];
    peopleDetails.forEach((person) => {
      const desc = (person.description || "").toLowerCase();
      if (desc.includes("mouth open") || desc.includes("speaking") || desc.includes("talking")) {
        mouthOpenFrames++;
      }
      if (desc.includes("looking at camera") || desc.includes("facing camera") || desc.includes("eye contact")) {
        lookingAtCameraFrames++;
      }
    });
  });

  const totalFrames = frameAnalyses.length || 1;
  const speakingRatio = speakingFrames / totalFrames;
  const mouthOpenRatio = mouthOpenFrames / totalFrames;
  const lookingAtCameraRatio = lookingAtCameraFrames / totalFrames;

  if (speakingRatio > 0.5 || mouthOpenRatio > 0.5) {
    speakingDetected = 30;
    reasons.push("Person appears to be speaking in video");
  } else if (speakingRatio > 0.2 || mouthOpenRatio > 0.2) {
    speakingDetected = 20;
    reasons.push("Some speaking detected in video");
  } else if (lookingAtCameraRatio > 0.5) {
    speakingDetected = 15;
    reasons.push("Person looking at camera (may be speaking)");
  } else {
    speakingDetected = 0;
    reasons.push("No clear indication of person speaking");
  }

  // 3. Video quality (0-20 points)
  // Check for video quality indicators in frame analyses
  let qualityFrames = 0;
  frameAnalyses.forEach((frame) => {
    const analysis = frame.analysis || {};
    const videoQuality = analysis.videoQuality || "";
    const lighting = analysis.lighting || "";

    if (
      videoQuality.toLowerCase().includes("good") ||
      videoQuality.toLowerCase().includes("clear") ||
      videoQuality.toLowerCase().includes("high")
    ) {
      qualityFrames++;
    }
    if (
      lighting.toLowerCase().includes("good") ||
      lighting.toLowerCase().includes("bright") ||
      lighting.toLowerCase().includes("well-lit")
    ) {
      qualityFrames++;
    }
  });

  const qualityRatio = qualityFrames / (totalFrames * 2); // *2 because we check two factors
  videoQuality = Math.round(20 * qualityRatio);

  if (videoQuality < 10) {
    reasons.push("Video quality may be poor");
  }

  // 4. Engagement score (0-20 points)
  // Check if person is engaged (looking at camera, facing camera, etc.)
  if (lookingAtCameraRatio > 0.5) {
    engagementScore = 20;
    reasons.push("Person appears engaged (looking at camera)");
  } else if (lookingAtCameraRatio > 0.2) {
    engagementScore = 15;
  } else {
    engagementScore = 10;
    reasons.push("Person may not be fully engaged");
  }

  const totalScore = personDetected + speakingDetected + videoQuality + engagementScore;

  return {
    score: Math.round(totalScore),
    maxScore: 100,
    breakdown: {
      personDetected: Math.round(personDetected),
      speakingDetected: Math.round(speakingDetected),
      videoQuality: Math.round(videoQuality),
      engagementScore: Math.round(engagementScore),
    },
    reasons: reasons.length > 0 ? reasons : ["Video quality assessment completed"],
    metrics: {
      averagePeopleCount: avgPeople,
      speakingFrames,
      totalFrames,
      speakingRatio: Math.round(speakingRatio * 100) / 100,
      lookingAtCameraRatio: Math.round(lookingAtCameraRatio * 100) / 100,
    },
  };
};

/**
 * Calculate overall quality score and recommendation
 * @param {Object} answerQuality - Answer quality score
 * @param {Object} videoQuality - Video quality score
 * @returns {Object} Overall quality assessment
 */
const calculateOverallQuality = (answerQuality, videoQuality) => {
  // Weighted average: 60% answer quality, 40% video quality
  const answerWeight = 0.6;
  const videoWeight = 0.4;

  const overallScore = Math.round(
    answerQuality.score * answerWeight + videoQuality.score * videoWeight
  );

  // Determine recommendation
  let recommendation = "keep";
  let recommendationReason = "";

  if (overallScore >= 70) {
    recommendation = "keep";
    recommendationReason = "High quality response, likely valuable";
  } else if (overallScore >= 50) {
    recommendation = "review";
    recommendationReason = "Moderate quality, review before keeping";
  } else if (overallScore >= 30) {
    recommendation = "review";
    recommendationReason = "Low quality, likely should be discarded";
  } else {
    recommendation = "discard";
    recommendationReason = "Very low quality, should be discarded";
  }

  return {
    overallScore,
    maxScore: 100,
    recommendation, // "keep", "review", or "discard"
    recommendationReason,
    weights: {
      answerQuality: answerWeight,
      videoQuality: videoWeight,
    },
    combinedReasons: [
      ...answerQuality.reasons,
      ...videoQuality.reasons,
    ],
  };
};

module.exports = {
  calculateAnswerQuality,
  calculateVideoQuality,
  calculateOverallQuality,
};

