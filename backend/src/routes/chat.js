import { Router } from "express";
import axios from "axios";
import OpenAI from "openai";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Fetch context from an external app
async function fetchContext(appName, appUrl, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const ctx = [];
  try {
    if (appName === "sprint-manager") {
      const now = new Date();
      const [spRes, evRes] = await Promise.all([
        axios.get(`${appUrl}/api/sprints`, { headers, params: { year: now.getFullYear(), month: now.getMonth() + 1 }, timeout: 5000 }),
        axios.get(`${appUrl}/api/events`,  { headers, params: { year: now.getFullYear(), month: now.getMonth() + 1 }, timeout: 5000 }),
      ]);
      if (spRes.data.length) ctx.push(`SPRINT THERAPY — Sessions this month:\n${JSON.stringify(spRes.data, null, 2)}`);
      if (evRes.data.length) ctx.push(`SPRINT THERAPY — Events this month:\n${JSON.stringify(evRes.data, null, 2)}`);
    }
    if (appName === "note-app") {
      const res = await axios.get(`${appUrl}/api/notes`, { headers, timeout: 5000 });
      if (res.data.length) ctx.push(`NOTES:\n${res.data.map(n => `[${n.title || "Untitled"}]\n${n.content}`).join("\n---\n")}`);
    }
    if (appName === "binance-bots") {
      const [botsRes, portRes] = await Promise.all([
        axios.get(`${appUrl}/api/bots`,      { headers, timeout: 5000 }),
        axios.get(`${appUrl}/api/portfolio`, { headers, timeout: 5000 }),
      ]);
      if (botsRes.data?.bots?.length)  ctx.push(`BINANCE BOTS:\n${JSON.stringify(botsRes.data.bots, null, 2)}`);
      if (portRes.data)                ctx.push(`BINANCE PORTFOLIO:\n${JSON.stringify(portRes.data, null, 2)}`);
    }
  } catch (err) {
    ctx.push(`[${appName}: could not fetch data — ${err.message}]`);
  }
  return ctx.join("\n\n");
}

// POST /api/chat/:conversationId
router.post("/:conversationId", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  // Verify conversation ownership
  const { rows: [conv] } = await pool.query(
    "SELECT * FROM conversations WHERE id=$1 AND user_id=$2", [conversationId, req.userId]
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  // Save user message
  await pool.query(
    "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'user',$2)",
    [conversationId, message]
  );

  // Fetch integrations context
  const { rows: integrations } = await pool.query(
    "SELECT * FROM api_integrations WHERE user_id=$1 AND enabled=true", [req.userId]
  );

  let contextBlock = "";
  if (integrations.length) {
    const contexts = await Promise.all(
      integrations.map(i => fetchContext(i.app_name, i.app_url, i.token))
    );
    const filled = contexts.filter(Boolean);
    if (filled.length) {
      contextBlock = `\n\n--- CONTEXT FROM CONNECTED APPS ---\n${filled.join("\n\n")}\n--- END CONTEXT ---`;
    }
  }

  // Fetch conversation history (last 20 messages)
  const { rows: history } = await pool.query(
    "SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20",
    [conversationId]
  );
  const historyMessages = history.reverse().slice(0, -1); // exclude the just-saved user message

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are a helpful personal AI assistant. You have access to the user's personal data from their connected apps.${contextBlock}

Answer questions naturally. When referencing data from the apps, be specific and helpful. Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 2000,
      stream: false,
    });

    const reply = completion.choices[0].message.content;

    // Save assistant reply
    await pool.query(
      "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
      [conversationId, reply]
    );

    // Auto-update conversation title from first message
    if (historyMessages.length === 0) {
      const title = message.slice(0, 60) + (message.length > 60 ? "…" : "");
      await pool.query("UPDATE conversations SET title=$1 WHERE id=$2", [title, conversationId]);
    }

    res.json({ reply, conversationId });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    // Save error as assistant message too
    const errMsg = "Sorry, I couldn't get a response. Please check your OpenAI API key in the integrations settings.";
    await pool.query(
      "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
      [conversationId, errMsg]
    );
    res.json({ reply: errMsg, conversationId });
  }
});

export default router;
