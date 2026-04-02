import { Router } from "express";
import axios from "axios";
import OpenAI from "openai";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Context fetching ──────────────────────────────────────────────────────────

async function fetchContext(name, appUrl, token) {
  try {
    const res = await axios.get(`${appUrl}/api/context`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    return { name, appUrl, token, data: res.data };
  } catch (err) {
    console.warn(`[context] ${name} (${appUrl}): ${err.message}`);
    return { name, appUrl, token, error: err.message };
  }
}

// ── Tool building from capabilities ──────────────────────────────────────────

function appSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildTools(contexts) {
  const tools = [];
  const toolMap = {}; // toolName → { appUrl, token, method, path }

  for (const ctx of contexts) {
    if (ctx.error || !ctx.data?.capabilities?.length) continue;
    const slug = appSlug(ctx.name);

    for (const cap of ctx.data.capabilities) {
      const toolName = `${slug}__${cap.name}`;
      tools.push({
        type: "function",
        function: {
          name: toolName,
          description: `[${ctx.name}] ${cap.description}`,
          parameters: cap.parameters,
        },
      });
      toolMap[toolName] = {
        appUrl:  ctx.appUrl,
        token:   ctx.token,
        method:  cap.method,
        path:    cap.path,
      };
    }
  }
  return { tools, toolMap };
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(toolName, args, toolMap) {
  const tool = toolMap[toolName];
  if (!tool) return { error: `Unknown tool: ${toolName}` };

  // Replace path params like {id}
  let path = tool.path;
  const body = { ...args };
  for (const key of Object.keys(args)) {
    if (path.includes(`{${key}}`)) {
      path = path.replace(`{${key}}`, args[key]);
      delete body[key];
    }
  }

  const url = `${tool.appUrl}${path}`;
  const headers = { Authorization: `Bearer ${tool.token}`, "Content-Type": "application/json" };

  try {
    let res;
    const method = tool.method.toUpperCase();
    if      (method === "GET")    res = await axios.get(url,          { headers, timeout: 8000 });
    else if (method === "POST")   res = await axios.post(url, body,   { headers, timeout: 8000 });
    else if (method === "PUT")    res = await axios.put(url, body,    { headers, timeout: 8000 });
    else if (method === "PATCH")  res = await axios.patch(url, body,  { headers, timeout: 8000 });
    else if (method === "DELETE") res = await axios.delete(url,       { headers, timeout: 8000 });
    else return { error: `Unsupported method: ${method}` };

    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    console.error(`[tool] ${toolName}: ${msg}`);
    return { error: msg };
  }
}

// ── Context block for system prompt ──────────────────────────────────────────

function buildContextBlock(contexts) {
  const ok = contexts.filter(c => !c.error);
  if (!ok.length) return "";
  const parts = ok.map(c => {
    // Exclude capabilities from the readable context block (they're in tools)
    const { capabilities: _, ...data } = c.data;
    return `=== ${c.name} ===\n${JSON.stringify(data, null, 2)}`;
  });
  return `\n\n--- CONTEXT FROM CONNECTED APPS ---\n${parts.join("\n\n")}\n--- END CONTEXT ---`;
}

// ── Main chat route ───────────────────────────────────────────────────────────

router.post("/:conversationId", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const { message, imageBase64, imageMimeType } = req.body;
  if (!message?.trim() && !imageBase64) return res.status(400).json({ error: "message or image required" });

  // Verify conversation ownership
  const { rows: [conv] } = await pool.query(
    "SELECT * FROM conversations WHERE id=$1 AND user_id=$2", [conversationId, req.userId]
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const textContent = message?.trim() || "";

  // Save user message (text only in DB)
  await pool.query(
    "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'user',$2)",
    [conversationId, textContent || "[image]"]  
  );

  // Load user AI settings
  const { rows: [settings] } = await pool.query(
    "SELECT openai_api_key, openai_model FROM user_settings WHERE user_id=$1", [req.userId]
  );
  const apiKey = settings?.openai_api_key || process.env.OPENAI_API_KEY || "";
  const model  = settings?.openai_model   || process.env.OPENAI_MODEL  || "gpt-5.4-mini";

  if (!apiKey) {
    const msg = "⚠️ No OpenAI API key configured. Go to **⚙️ Settings → AI Settings** to add your key.";
    await pool.query("INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)", [conversationId, msg]);
    return res.json({ reply: msg });
  }

  // Fetch context + capabilities from all enabled integrations
  const { rows: integrations } = await pool.query(
    "SELECT name, app_url, token FROM api_integrations WHERE user_id=$1 AND enabled=true",
    [req.userId]
  );
  const contexts = integrations.length
    ? await Promise.all(integrations.map(i => fetchContext(i.name, i.app_url, i.token)))
    : [];

  const contextBlock        = buildContextBlock(contexts);
  const { tools, toolMap }  = buildTools(contexts);

  // Load conversation history (last 20 messages)
  const { rows: history } = await pool.query(
    "SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20",
    [conversationId]
  );
  const historyMessages = history.reverse().slice(0, -1);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const systemPrompt =
    `You are a helpful personal AI assistant with full read and write access to the user's connected apps.` +
    (contextBlock ? " The current data from connected apps is provided below." : "") +
    `\nToday is ${today}.` +
    contextBlock +
    `\n\nWhen the user asks you to create, update or delete data, use the available tools to do it directly. ` +
    `Always confirm what you did after executing a tool. ` +
    `Answer in the same language the user writes in.`;

  const openai = new OpenAI({ apiKey });

  // ── First OpenAI call ─────────────────────────────────────────────────────
  let messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user",   content: imageBase64
        ? [
            ...(textContent ? [{ type: "text", text: textContent }] : []),
            { type: "image_url", image_url: { url: `data:${imageMimeType || "image/png"};base64,${imageBase64}`, detail: "auto" } },
          ]
        : textContent
    },
  ];

  try {
    const firstCall = await openai.chat.completions.create({
      model,
      messages,
      tools:       tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      max_completion_tokens:  2000,
    });

    const firstChoice = firstCall.choices[0];

    // ── No tool calls — direct reply ─────────────────────────────────────────
    if (firstChoice.finish_reason !== "tool_calls") {
      const reply = firstChoice.message.content;
      await pool.query(
        "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
        [conversationId, reply]
      );
      if (historyMessages.length === 0) {
        await pool.query("UPDATE conversations SET title=$1 WHERE id=$2",
          [(textContent || "Image").slice(0, 60) + ((textContent || "Image").length > 60 ? "…" : ""), conversationId]);
      }
      return res.json({ reply });
    }

    // ── Execute tool calls ────────────────────────────────────────────────────
    const toolCalls = firstChoice.message.tool_calls;
    console.log(`[tools] Executing ${toolCalls.length} tool call(s)`);

    const toolResults = await Promise.all(
      toolCalls.map(async tc => {
        const args   = JSON.parse(tc.function.arguments);
        const result = await executeTool(tc.function.name, args, toolMap);
        console.log(`[tool] ${tc.function.name}(${JSON.stringify(args)}) →`, JSON.stringify(result).slice(0, 120));
        return { tool_call_id: tc.id, result };
      })
    );

    // ── Second OpenAI call with tool results ─────────────────────────────────
    const messagesWithTools = [
      ...messages,
      firstChoice.message, // assistant message with tool_calls
      ...toolResults.map(tr => ({
        role:         "tool",
        tool_call_id: tr.tool_call_id,
        content:      JSON.stringify(tr.result),
      })),
    ];

    const secondCall = await openai.chat.completions.create({
      model,
      messages: messagesWithTools,
      max_completion_tokens: 2000,
    });

    const reply = secondCall.choices[0].message.content;

    // Save final assistant reply
    await pool.query(
      "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
      [conversationId, reply]
    );
    if (historyMessages.length === 0) {
      await pool.query("UPDATE conversations SET title=$1 WHERE id=$2",
        [(textContent || "Image").slice(0, 60) + ((textContent || "Image").length > 60 ? "…" : ""), conversationId]);
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
