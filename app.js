require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "API is running",
  });
});

app.use("/auth", authRoutes);
app.use("/jobs", jobRoutes);
app.use("/ai", aiRoutes);

app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  return res.status(500).json({
    error: "Internal server error",
  });
});

module.exports = app;
