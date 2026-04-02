import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// List conversations
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC",
    [req.userId]
  );
  res.json(rows);
});

// Create conversation
router.post("/", requireAuth, async (req, res) => {
  const { title = "New conversation" } = req.body;
  const { rows: [conv] } = await pool.query(
    "INSERT INTO conversations (user_id,title) VALUES ($1,$2) RETURNING *", [req.userId, title]
  );
  res.status(201).json(conv);
});

// Update title
router.patch("/:id", requireAuth, async (req, res) => {
  const { title } = req.body;
  const { rows } = await pool.query(
    "UPDATE conversations SET title=$1 WHERE id=$2 AND user_id=$3 RETURNING *",
    [title, req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// Delete conversation
router.delete("/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM conversations WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
  res.json({ deleted: true });
});

// Get messages
router.get("/:id/messages", requireAuth, async (req, res) => {
  // Verify ownership
  const { rows: [conv] } = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]
  );
  if (!conv) return res.status(404).json({ error: "Not found" });
  const { rows } = await pool.query(
    "SELECT id,role,content,created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at",
    [req.params.id]
  );
  res.json(rows);
});

export default router;
