import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/integrations
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,name,app_url,enabled,created_at FROM api_integrations WHERE user_id=$1 ORDER BY created_at",
    [req.userId]
  );
  res.json(rows);
});

// POST /api/integrations
router.post("/", requireAuth, async (req, res) => {
  const { name, app_url, token } = req.body;
  if (!name?.trim() || !app_url?.trim() || !token?.trim())
    return res.status(400).json({ error: "name, app_url and token are required" });
  try {
    const { rows: [row] } = await pool.query(
      "INSERT INTO api_integrations (user_id,name,app_url,token) VALUES ($1,$2,$3,$4) RETURNING id,name,app_url,enabled,created_at",
      [req.userId, name.trim(), app_url.trim().replace(/\/$/, ""), token.trim()]
    );
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// PUT /api/integrations/:id
router.put("/:id", requireAuth, async (req, res) => {
  const { name, app_url, token, enabled } = req.body;
  try {
    const fields = []; const vals = [];
    if (name    !== undefined) fields.push(`name=$${vals.push(name.trim())}`);
    if (app_url !== undefined) fields.push(`app_url=$${vals.push(app_url.trim().replace(/\/$/, ""))}`);
    if (token   !== undefined && token !== "") fields.push(`token=$${vals.push(token.trim())}`);
    if (enabled !== undefined) fields.push(`enabled=$${vals.push(enabled)}`);
    if (!fields.length) return res.json({ ok: true });
    vals.push(req.params.id, req.userId);
    const { rows } = await pool.query(
      `UPDATE api_integrations SET ${fields.join(",")} WHERE id=$${vals.length-1} AND user_id=$${vals.length} RETURNING id,name,app_url,enabled,created_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// DELETE /api/integrations/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM api_integrations WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
  res.json({ deleted: true });
});

export default router;
