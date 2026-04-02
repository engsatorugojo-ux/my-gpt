import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: "All fields required" });
  try {
    if ((await pool.query("SELECT id FROM users WHERE email=$1", [email])).rows.length)
      return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await pool.query(
      "INSERT INTO users (email,password_hash,name) VALUES ($1,$2,$3) RETURNING id,email,name", [email, hash, name]
    );
    res.status(201).json({ token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" }), user });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "All fields required" });
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: "Invalid credentials" });
    const u = rows[0];
    res.json({ token: jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: "30d" }), user: { id: u.id, email: u.email, name: u.name } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
