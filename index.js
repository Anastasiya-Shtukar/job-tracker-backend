const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let jobs = [
  { id: 1, title: "Frontend developer", company: "Google" },
  { id: 2, title: "Backend developer", company: "Amazon" },
];

let message = { message: "Backend works" };

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

app.get("/test", (req, res) => {
  res.json(message);
});

app.post("/jobs", (req, res) => {
  const { title, company, status } = req.body;
  const allowedStatus = ["applied", "interview", "rejected"];

  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!title || !company) {
    return res.status(400).json({
      error: "Title and company are required",
    });
  }

  const newJob = {
    id: Date.now(),
    title,
    company,
    status: status || "applied",
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

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
