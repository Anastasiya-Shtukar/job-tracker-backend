const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const authenticateUser = require("../middleware/authenticateUser");
const { normalizeEmail } = require("../utils/normalize");

const router = express.Router();

const MINIMUM_PASSWORD_LENGTH = 8;

const getPassword = (value) => (typeof value === "string" ? value : "");

router.post("/register", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const password = getPassword(req.body.password);

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters`,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email;`,
      [normalizedEmail, passwordHash],
    );

    const user = result.rows[0];

    return res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    return res.status(500).json({
      error: "Failed to register",
    });
  }
});

router.post("/login", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const password = getPassword(req.body.password);

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM users
       WHERE email = $1;`,
      [normalizedEmail],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Failed to login",
    });
  }
});

router.get("/me", authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email
       FROM users
       WHERE id = $1;`,
      [req.userId],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error("Fetch current user error:", error);

    return res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});

module.exports = router;
