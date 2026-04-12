const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let jobs = [
  {
    id: 1,
    title: "Frontend developer",
    company: "Google",
    status: "interview",
    details: "Warszawa",
  },
  {
    id: 2,
    title: "Backend developer",
    company: "Amazon",
    status: "rejected",
    details: "Warszawa",
  },
];

const allowedStatus = ["applied", "interview", "rejected"];
const allowedFields = ["title", "company", "status", "details"];

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/jobs", (req, res) => {
  const { status } = req.query;

  if (status) {
    const filteredJobs = jobs.filter((job) => job.status === status);
    return res.json(filteredJobs);
  }

  res.json(jobs);
});

app.post("/jobs", (req, res) => {
  const { title, company, status, details } = req.body;

  const normalizedCompany = normalizeString(company);
  const normalizedDetails = normalizeString(details);
  const normalizedTitle = normalizeString(title);

  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!normalizedTitle || !normalizedCompany) {
    return res.status(400).json({
      error: "Title and company are required",
    });
  }

  const newJob = {
    id: Date.now(),
    title: normalizedTitle,
    company: normalizedCompany,
    status: status || "applied",
    details: normalizedDetails,
  };

  jobs.push(newJob);

  res.json({
    message: "Job added",
    job: newJob,
  });
});

app.delete("/jobs/:id", (req, res) => {
  const id = Number(req.params.id);

  jobs = jobs.filter((job) => job.id !== id);

  res.json({
    message: "Job deleted",
  });
});

app.patch("/jobs/:id", (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body;
  const job = jobs.find((job) => job.id === id);
  const incomingFields = Object.keys(updates);
  const index = jobs.findIndex((job) => job.id === id);

  if (!job) {
    return res.status(404).json({
      error: "Not Found",
    });
  }

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

  const updatedJob = {
    ...job,
    ...normalizedUpdates,
  };

  jobs[index] = updatedJob;

  return res.json(updatedJob);
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
