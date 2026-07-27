const express = require("express");

const authenticateUser = require("../middleware/authenticateUser");
const { generateDetailsSuggestion } = require("../services/aiService");
const { extractJobData } = require("../services/jobExtractionService");
const { normalizeString, normalizeUrl } = require("../utils/normalize");

const router = express.Router();

router.use(authenticateUser);

router.post("/suggest-details", async (req, res) => {
  const normalizedDetails = normalizeString(req.body.details);

  if (!normalizedDetails) {
    return res.status(400).json({
      error: "Empty request",
    });
  }

  try {
    const suggestion = await generateDetailsSuggestion(normalizedDetails);

    return res.json({
      suggestion,
    });
  } catch (error) {
    console.error("OpenAI suggestion error:", error);

    return res.status(500).json({
      error: "Failed to generate suggestion",
    });
  }
});

router.post("/extract-job", async (req, res) => {
  const normalizedText = normalizeString(req.body.text);
  const normalizedUrl = normalizeUrl(req.body.url);

  if (!normalizedText && !normalizedUrl) {
    return res.status(400).json({
      error: "Job URL or job posting text is required",
    });
  }

  try {
    const job = await extractJobData({
      text: normalizedText,
      url: normalizedUrl,
    });

    return res.json({
      job,
    });
  } catch (error) {
    console.error("Job extraction error:", error);

    if (
      error.code === "JOB_PAGE_UNAVAILABLE" ||
      error.code === "JOB_PAGE_CONTENT_TOO_SHORT" ||
      error.code === "MISSING_JOB_SOURCE"
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error.code === "INVALID_AI_JSON") {
      return res.status(500).json({
        error: "AI returned invalid JSON",
      });
    }

    return res.status(500).json({
      error: "Failed to generate answer",
    });
  }
});

module.exports = router;
