const express = require("express");

const pool = require("../db");
const authenticateUser = require("../middleware/authenticateUser");
const { normalizeString, normalizeUrl } = require("../utils/normalize");

const router = express.Router();

const allowedStatuses = ["applied", "interview", "rejected"];

const allowedUpdateFields = ["title", "company", "status", "details"];

const parseJobId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

router.use(authenticateUser);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         title,
         company,
         status,
         details,
         job_url,
         created_at,
         updated_at
       FROM jobs
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [req.userId],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Fetch jobs error:", error);

    return res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
});

router.post("/", async (req, res) => {
  const normalizedTitle = normalizeString(req.body.title);
  const normalizedCompany = normalizeString(req.body.company);
  const normalizedDetails = normalizeString(req.body.details);
  const normalizedJobUrl = normalizeUrl(req.body.job_url);

  const status = req.body.status || "applied";

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status",
    });
  }

  if (!normalizedTitle || !normalizedCompany || !normalizedJobUrl) {
    return res.status(400).json({
      error: "Title, company and job URL are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO jobs (
         title,
         company,
         status,
         details,
         job_url,
         user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         title,
         company,
         status,
         details,
         job_url,
         created_at,
         updated_at;`,
      [
        normalizedTitle,
        normalizedCompany,
        status,
        normalizedDetails,
        normalizedJobUrl,
        req.userId,
      ],
    );

    return res.status(201).json({
      job: result.rows[0],
    });
  } catch (error) {
    console.error("Create job error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "This job offer already exists",
      });
    }

    return res.status(500).json({
      error: "Failed to add job",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseJobId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "Invalid job id",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM jobs
       WHERE id = $1
         AND user_id = $2
       RETURNING id;`,
      [id, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.status(200).json({
      message: "Job deleted",
    });
  } catch (error) {
    console.error("Delete job error:", error);

    return res.status(500).json({
      error: "Failed to delete job",
    });
  }
});

router.patch("/:id", async (req, res) => {
  const id = parseJobId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "Invalid job id",
    });
  }

  const updates = req.body;
  const incomingFields = Object.keys(updates);

  if (incomingFields.length === 0) {
    return res.status(400).json({
      error: "Empty request",
    });
  }

  const containsOnlyAllowedFields = incomingFields.every((field) =>
    allowedUpdateFields.includes(field),
  );

  if (!containsOnlyAllowedFields) {
    return res.status(400).json({
      error: "Invalid update fields",
    });
  }

  const normalizedUpdates = {};

  if ("status" in updates) {
    if (!allowedStatuses.includes(updates.status)) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    normalizedUpdates.status = updates.status;
  }

  if ("title" in updates) {
    const normalizedTitle = normalizeString(updates.title);

    if (!normalizedTitle) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    normalizedUpdates.title = normalizedTitle;
  }

  if ("company" in updates) {
    const normalizedCompany = normalizeString(updates.company);

    if (!normalizedCompany) {
      return res.status(400).json({
        error: "Company is required",
      });
    }

    normalizedUpdates.company = normalizedCompany;
  }

  if ("details" in updates) {
    if (typeof updates.details !== "string") {
      return res.status(400).json({
        error: "Details must be a string",
      });
    }

    normalizedUpdates.details = normalizeString(updates.details);
  }

  const entries = Object.entries(normalizedUpdates);

  const setClauses = entries.map(
    ([field], index) => `${field} = $${index + 1}`,
  );

  const values = entries.map(([, value]) => value);

  try {
    const idPlaceholder = values.length + 1;
    const userIdPlaceholder = values.length + 2;

    const result = await pool.query(
      `UPDATE jobs
       SET ${setClauses.join(", ")},
           updated_at = NOW()
       WHERE id = $${idPlaceholder}
         AND user_id = $${userIdPlaceholder}
       RETURNING
         id,
         title,
         company,
         status,
         details,
         job_url,
         created_at,
         updated_at;`,
      [...values, id, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Update job error:", error);

    return res.status(500).json({
      error: "Failed to update job",
    });
  }
});

module.exports = router;
