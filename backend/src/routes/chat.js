import { Router } from "express";
import axios from "axios";
import OpenAI from "openai";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Fetch context from any app that implements GET /api/context
async function fetchContext(name, appUrl, token) {
  try {
    const res = await axios.get(`${appUrl}/api/context`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    return { name, data: res.data };
  } catch (err) {
    return { name, error: err.message };
  }
}

function buildContextBlock(contexts) {
  if (!contexts.length) return "";
  const parts = contexts.map(c => {
    if (c.error) return `[${c.name}: unavailable — ${c.error}]`;
    return `=== ${c.name} ===\n${JSON.stringify(c.data, null, 2)}`;
  });
  return `\n\n--- CONTEXT FROM CONNECTED APPS ---\n${parts.join("\n\n")}\n--- END CONTEXT ---`;
}

// POST /api/chat/:conversationId
router.post("/:conversationId", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  // Verify ownership
  const { rows: [conv] } = await pool.query(
    "SELECT * FROM conversations WHERE id=$1 AND user_id=$2", [conversationId, req.userId]
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  // Save user message
  await pool.query(
    "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'user',$2)",
    [conversationId, message]
  );

  // Load user's AI settings
  const { rows: [settings] } = await pool.query(
    "SELECT openai_api_key, openai_model FROM user_settings WHERE user_id=$1", [req.userId]
  );
  const apiKey = settings?.openai_api_key || process.env.OPENAI_API_KEY || "";
  const model  = settings?.openai_model   || process.env.OPENAI_MODEL  || "gpt-4o";

  // Fetch context from all enabled integrations in parallel
  const { rows: integrations } = await pool.query(
    "SELECT name, app_url, token FROM api_integrations WHERE user_id=$1 AND enabled=true",
    [req.userId]
  );
  const contexts = integrations.length
    ? await Promise.all(integrations.map(i => fetchContext(i.name, i.app_url, i.token)))
    : [];

  const contextBlock = buildContextBlock(contexts);

  // Fetch conversation history (last 20 messages)
  const { rows: history } = await pool.query(
    "SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20",
    [conversationId]
  );
  const historyMessages = history.reverse().slice(0, -1);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = `You are a helpful personal AI assistant.${contextBlock ? " You have access to the user's personal data from their connected apps." : ""}
Today is ${today}.${contextBlock}

Answer in the same language the user writes in. Be concise and helpful.`;

  if (!apiKey) {
    const errMsg = "⚠️ No OpenAI API key configured. Go to **Settings → AI Settings** to add your key.";
    await pool.query("INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)", [conversationId, errMsg]);
    return res.json({ reply: errMsg });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 2000,
    });

    const reply = completion.choices[0].message.content;
    await pool.query(
      "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
      [conversationId, reply]
    );

    // Auto-title from first user message
    if (historyMessages.length === 0) {
      await pool.query(
        "UPDATE conversations SET title=$1 WHERE id=$2",
        [message.slice(0, 60) + (message.length > 60 ? "…" : ""), conversationId]
      );
    }
    res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    const errMsg = `❌ OpenAI error: ${err.message}`;
    await pool.query("INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)", [conversationId, errMsg]);
    res.json({ reply: errMsg });
  }
});

export default router;
