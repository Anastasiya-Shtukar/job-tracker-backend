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
  const { title, company, status, details } = req.body;

  const normalizedCompany = normalizeString(company);
  const normalizedDetails = normalizeString(details);
  const normalizedTitle = normalizeString(title);
  const finalStatus = status || "applied";

  if (finalStatus && !allowedStatus.includes(finalStatus)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!normalizedTitle || !normalizedCompany) {
    return res.status(400).json({
      error: "Title and company are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO jobs (title, company, status, details)
VALUES ($1, $2, $3, $4)
RETURNING *;`,
      [normalizedTitle, normalizedCompany, finalStatus, normalizedDetails],
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

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
