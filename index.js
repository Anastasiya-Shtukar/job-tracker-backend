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
  res.json(jobs);
});

app.get("/test", (req, res) => {
  res.json(message);
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
