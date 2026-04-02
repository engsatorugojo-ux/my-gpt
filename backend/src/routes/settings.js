import { Router } from "express";
import axios from "axios";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/settings
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT openai_api_key, openai_model FROM user_settings WHERE user_id=$1",
    [req.userId]
  );
  if (!rows.length) return res.json({ openai_api_key: "", openai_model: "gpt-4.5-mini" });
  // Never expose the full key — mask it
  const s = rows[0];
  res.json({
    openai_api_key_set: !!s.openai_api_key,
    openai_api_key_hint: s.openai_api_key ? s.openai_api_key.slice(0, 7) + "…" : "",
    openai_model: s.openai_model,
  });
});

// PUT /api/settings
router.put("/", requireAuth, async (req, res) => {
  const { openai_api_key, openai_model } = req.body;
  try {
    const exists = await pool.query("SELECT user_id FROM user_settings WHERE user_id=$1", [req.userId]);
    if (exists.rows.length) {
      const fields = [];
      const vals   = [];
      if (openai_api_key !== undefined) { fields.push(`openai_api_key=$${vals.push(openai_api_key)}`); }
      if (openai_model   !== undefined) { fields.push(`openai_model=$${vals.push(openai_model)}`); }
      if (fields.length) {
        vals.push(req.userId);
        await pool.query(`UPDATE user_settings SET ${fields.join(",")} WHERE user_id=$${vals.length}`, vals);
      }
    } else {
      await pool.query(
        "INSERT INTO user_settings (user_id,openai_api_key,openai_model) VALUES ($1,$2,$3)",
        [req.userId, openai_api_key || "", openai_model || "gpt-4.5-mini"]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// GET /api/settings/models — fetch available models from OpenAI using user's key
router.get("/models", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT openai_api_key FROM user_settings WHERE user_id=$1", [req.userId]
  );
  const apiKey = rows[0]?.openai_api_key || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.json({ models: getDefaultModels() });

  try {
    const response = await axios.get("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000,
    });
    // Filter to chat-capable models only, sorted nicely
    const chatModels = response.data.data
      .map(m => m.id)
      .filter(id =>
        id.startsWith("gpt-4") ||
        id.startsWith("gpt-3.5") ||
        id.startsWith("o1") ||
        id.startsWith("o3") ||
        id.startsWith("chatgpt")
      )
      .filter(id => !id.includes("instruct") && !id.includes("vision-preview"))
      .sort((a, b) => {
        // Prefer newer/flagship models first
        const rank = id => {
          if (id.includes("o3"))       return 0;
          if (id.includes("o1"))       return 1;
          if (id === "gpt-4.5-mini")  return 2;
          if (id === "gpt-4o")         return 3;
          if (id.startsWith("gpt-4o")) return 4;
          if (id.startsWith("gpt-4"))  return 5;
          return 5;
        };
        return rank(a) - rank(b);
      });
    res.json({ models: chatModels.length ? chatModels : getDefaultModels() });
  } catch (err) {
    console.error("OpenAI models fetch failed:", err.message);
    res.json({ models: getDefaultModels() });
  }
});

function getDefaultModels() {
  return ["gpt-4.5-mini", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"];
}

export default router;
