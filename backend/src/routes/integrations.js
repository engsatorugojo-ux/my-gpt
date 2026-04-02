import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,app_name,app_url,enabled,created_at FROM api_integrations WHERE user_id=$1 ORDER BY app_name",
    [req.userId]
  );
  res.json(rows);
});

router.put("/:appName", requireAuth, async (req, res) => {
  const { app_url, token, enabled } = req.body;
  const { appName } = req.params;
  try {
    const existing = await pool.query(
      "SELECT id FROM api_integrations WHERE user_id=$1 AND app_name=$2", [req.userId, appName]
    );
    if (existing.rows.length) {
      const { rows: [row] } = await pool.query(
        `UPDATE api_integrations SET app_url=$1, token=$2, enabled=$3
         WHERE user_id=$4 AND app_name=$5 RETURNING id,app_name,app_url,enabled`,
        [app_url, token, enabled ?? true, req.userId, appName]
      );
      res.json(row);
    } else {
      const { rows: [row] } = await pool.query(
        "INSERT INTO api_integrations (user_id,app_name,app_url,token,enabled) VALUES ($1,$2,$3,$4,$5) RETURNING id,app_name,app_url,enabled",
        [req.userId, appName, app_url, token, enabled ?? true]
      );
      res.status(201).json(row);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/:appName", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM api_integrations WHERE user_id=$1 AND app_name=$2", [req.userId, req.params.appName]);
  res.json({ deleted: true });
});

export default router;
