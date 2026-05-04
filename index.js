const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const pool = require("./db.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/jobs", authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jobs
   WHERE user_id = $1
   ORDER BY created_at DESC;`,
      [req.userId],
    );
    console.log(req.userId);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.post("/jobs", authenticateUser, async (req, res) => {
  const { title, company, status, details, job_url } = req.body;
  console.log("POST /jobs userId:", req.userId);

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
      `INSERT INTO jobs (title, company, status, details, job_url, user_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, title, company, status, details, job_url, created_at, updated_at;`,
      [
        normalizedTitle,
        normalizedCompany,
        finalStatus,
        normalizedDetails,
        finalUrl,
        req.userId,
      ],
    );
    res.status(201).json({ job: result.rows[0] });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "This job offer already exists",
      });
    }

    res.status(500).json({ error: "Failed to add job" });
  }
});

app.delete("/jobs/:id", authenticateUser, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM jobs
WHERE id = $1 AND user_id = $2
RETURNING id, title, company, status, details, job_url, created_at, updated_at;`,
      [id, req.userId],
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

app.patch("/jobs/:id", authenticateUser, async (req, res) => {
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
WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
RETURNING id, title, company, status, details, job_url, created_at, updated_at;`,
      [...values, id, req.userId],
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
  const { text, url } = req.body;
  const normalizedText = normalizeString(text);
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedText && !normalizedUrl) {
    return res
      .status(400)
      .json({ error: "Job URL or job posting text is required" });
  }

  let sourceText = normalizedText;

  if (!sourceText && normalizedUrl) {
    let pageResponse;

    try {
      pageResponse = await fetch(normalizedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        },
      });
    } catch (error) {
      return res.status(400).json({
        error: "Couldn’t read this URL. Paste the job posting text manually.",
      });
    }

    if (!pageResponse.ok) {
      return res.status(400).json({
        error: "Couldn’t read this URL. Paste the job posting text manually.",
      });
    }

    const html = await pageResponse.text();

    sourceText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (sourceText.length < 300) {
      return res.status(400).json({
        error: "Couldn’t read this URL. Paste the job posting text manually.",
      });
    }
  }

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
${sourceText.slice(0, 12000)}
`;

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

app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;
  const normalisedEmail = normalizeString(email);
  const normalizedPassword = normalizeString(password);

  if (!normalisedEmail || !normalizedPassword) {
    return res.status(400).json({ error: "Email and password is required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING id, email;`,
      [normalisedEmail, hashedPassword],
    );
    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalisedEmail = normalizeString(email);
  const normalizedPassword = normalizeString(password);

  if (!normalisedEmail || !normalizedPassword) {
    return res.status(400).json({ error: "Email and password is required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash
FROM users
WHERE email = $1;`,
      [normalisedEmail],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      normalizedPassword,
      user.password_hash,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to login" });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
