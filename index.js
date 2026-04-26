const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const pool = require("./db.js");

const app = express();

app.use(cors());
app.use(express.json());

const allowedStatus = ["applied", "interview", "rejected"];
const allowedFields = ["title", "company", "status", "details"];

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeUrl = (value) => {
  const trimmed = normalizeString(value);

  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/jobs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM jobs");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.post("/jobs", async (req, res) => {
  const { title, company, status, details, job_url } = req.body;

  const normalizedCompany = normalizeString(company);
  const normalizedDetails = normalizeString(details);
  const normalizedTitle = normalizeString(title);
  const finalStatus = status || "applied";

  const finalUrl = normalizeUrl(job_url);

  if (finalStatus && !allowedStatus.includes(finalStatus)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!normalizedTitle || !normalizedCompany || !finalUrl) {
    return res.status(400).json({
      error: "Title, company and job URL are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO jobs (title, company, status, details, job_url)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;`,
      [
        normalizedTitle,
        normalizedCompany,
        finalStatus,
        normalizedDetails,
        finalUrl,
      ],
    );
    res.status(201).json({ job: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add job" });
  }
});

app.delete("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM jobs
WHERE id = $1
RETURNING *;`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    } else {
      return res.status(200).json({ message: "Job deleted" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete job" });
  }
});

app.patch("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body;
  const incomingFields = Object.keys(updates);

  if (incomingFields.length === 0) {
    return res.status(400).json({
      error: "Empty Request",
    });
  }

  const isValidFields = incomingFields.every((field) =>
    allowedFields.includes(field),
  );

  if (!isValidFields) {
    return res.status(400).json({
      error: "Bad Request",
    });
  }

  const normalizedUpdates = {};

  if ("status" in updates) {
    if (!allowedStatus.includes(updates.status)) {
      return res.status(400).json({
        error: "invalid status",
      });
    }
    normalizedUpdates.status = updates.status;
  }

  if ("title" in updates) {
    if (typeof updates.title !== "string" || !updates.title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    normalizedUpdates.title = normalizeString(updates.title);
  }

  if ("company" in updates) {
    if (typeof updates.company !== "string" || !updates.company.trim()) {
      return res.status(400).json({ error: "Company is required" });
    }
    normalizedUpdates.company = normalizeString(updates.company);
  }

  if ("details" in updates) {
    if (typeof updates.details !== "string") {
      return res.status(400).json({ error: "Details must be a string" });
    }
    normalizedUpdates.details = normalizeString(updates.details);
  }

  const entries = Object.entries(normalizedUpdates);
  const setClauses = entries.map(([key], index) => `${key} = $${index + 1}`);
  const values = entries.map(([, value]) => value);

  try {
    const result = await pool.query(
      `UPDATE jobs
SET ${setClauses.join(", ")},
    updated_at = NOW()
WHERE id = $${values.length + 1}
RETURNING *;`,
      [...values, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/ai/suggest-details", async (req, res) => {
  const { details } = req.body;
  const normalizedDetails = normalizeString(details);
  if (!normalizedDetails) {
    return res.status(400).json({ error: "Empty request" });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `Rewrite and shorten this job details. 
Do not add new facts. Return 1-2 sentences.

Text:
${normalizedDetails}`,
    });

    const suggestion = response.output_text;

    if (!suggestion.trim()) {
      return res.status(500).json({
        error: "Failed to generate suggestion",
      });
    }

    return res.json({ suggestion });
  } catch (error) {
    console.error("OpenAI error:", error);
    return res.status(500).json({
      error: "Failed to generate suggestion",
    });
  }
});

app.post("/ai/extract-job", async (req, res) => {
  const { text } = req.body;
  console.log(text);
  const normalizedText = normalizeString(text);
  console.log(normalizedText);
  const prompt = `
You are extracting job posting data for a job tracking app.

Analyze the text and return structured data.

Important rules:
- Detect the language of the input text.
- Return all values in the same language as the input text.
- Do not translate the content to English unless the input is in English.
- Do not invent missing information.
- If a field is missing or unclear, use an empty string.
- Keep "details" concise and useful for a user tracking job applications.
- "details" should include key requirements, work mode, location, seniority, or technologies only if they appear in the text.
- Return only valid JSON.
- No markdown.
- No comments.
- No extra text.

JSON shape:
{
  "title": "",
  "company": "",
  "details": ""
}

Input text:
${normalizedText}
`;

  if (!normalizedText) {
    return res.status(400).json({ error: "Empty request" });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const answerAi = response.output_text;

    if (!answerAi.trim()) {
      return res.status(500).json({
        error: "Failed to generate suggestion",
      });
    }

    let extractedJob;

    try {
      extractedJob = JSON.parse(answerAi);
    } catch (error) {
      return res.status(500).json({
        error: "AI returned invalid JSON",
      });
    }

    return res.json({ job: extractedJob });
  } catch (error) {
    console.error("OpenAI error:", error);
    return res.status(500).json({
      error: "Failed to generate answer",
    });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
