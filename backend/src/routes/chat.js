import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Web search via DuckDuckGo ─────────────────────────────────────────────────

async function webSearch(query, maxResults = 10) {
  try {
    const { data: html } = await axios.get(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(html);
    const results = [];

    $(".result").each((_, el) => {
      if (results.length >= maxResults) return false;
      const title   = $(el).find(".result__title").text().trim();
      const rawUrl  = $(el).find(".result__url").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      if (title && snippet) results.push({ title, url: rawUrl, snippet });
    });

    return { query, results, count: results.length };
  } catch (err) {
    return { query, results: [], error: err.message };
  }
}

// ── Built-in tools (always available regardless of integrations) ──────────────

const BUILTIN_TOOLS = [
  {
    type: "function",
    function: {
      name: "__web_search",
      description: "Search the internet using DuckDuckGo. Use this for current events, news, facts, prices, or anything that might need up-to-date information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

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

// ── Integration tool building ─────────────────────────────────────────────────

function appSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildIntegrationTools(contexts) {
  const tools   = [];
  const toolMap = {};
  for (const ctx of contexts) {
    if (ctx.error || !ctx.data?.capabilities?.length) continue;
    const slug = appSlug(ctx.name);
    for (const cap of ctx.data.capabilities) {
      const toolName = `${slug}__${cap.name}`;
      tools.push({ type: "function", function: { name: toolName, description: `[${ctx.name}] ${cap.description}`, parameters: cap.parameters } });
      toolMap[toolName] = { appUrl: ctx.appUrl, token: ctx.token, method: cap.method, path: cap.path };
    }
  }
  return { tools, toolMap };
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(toolName, args, toolMap) {
  // Built-in: web search
  if (toolName === "__web_search") {
    return webSearch(args.query);
  }

  // Integration tool
  const tool = toolMap[toolName];
  if (!tool) return { error: `Unknown tool: ${toolName}` };

  let path = tool.path;
  const body = { ...args };
  for (const key of Object.keys(args)) {
    if (path.includes(`{${key}}`)) { path = path.replace(`{${key}}`, args[key]); delete body[key]; }
  }

  const url = `${tool.appUrl}${path}`;
  const headers = { Authorization: `Bearer ${tool.token}`, "Content-Type": "application/json" };

  try {
    const method = tool.method.toUpperCase();
    let res;
    if      (method === "GET")    res = await axios.get(url,         { headers, timeout: 8000 });
    else if (method === "POST")   res = await axios.post(url, body,  { headers, timeout: 8000 });
    else if (method === "PUT")    res = await axios.put(url, body,   { headers, timeout: 8000 });
    else if (method === "PATCH")  res = await axios.patch(url, body, { headers, timeout: 8000 });
    else if (method === "DELETE") res = await axios.delete(url,      { headers, timeout: 8000 });
    else return { error: `Unsupported method: ${method}` };
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    console.error(`[tool] ${toolName}: ${msg}`);
    return { error: msg };
  }
}

// ── Tool display name ─────────────────────────────────────────────────────────

function toolDisplayName(toolName, args) {
  if (toolName === "__web_search") return `Searched the web for "${args.query}"`;
  const parts = toolName.split("__");
  const cap   = parts.slice(1).join(" ").replace(/_/g, " ");
  const app   = parts[0].replace(/_/g, " ");
  return `${cap} on ${app}`;
}

// ── Context block ─────────────────────────────────────────────────────────────

function buildContextBlock(contexts) {
  const ok = contexts.filter(c => !c.error);
  if (!ok.length) return "";
  const parts = ok.map(c => {
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

  const { rows: [conv] } = await pool.query(
    "SELECT * FROM conversations WHERE id=$1 AND user_id=$2", [conversationId, req.userId]
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const textContent = message?.trim() || "";
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
    return res.json({ reply: msg, steps: [] });
  }

  // Fetch integrations context
  const { rows: integrations } = await pool.query(
    "SELECT name, app_url, token FROM api_integrations WHERE user_id=$1 AND enabled=true", [req.userId]
  );
  const contexts = integrations.length
    ? await Promise.all(integrations.map(i => fetchContext(i.name, i.app_url, i.token)))
    : [];

  const contextBlock                    = buildContextBlock(contexts);
  const { tools: intTools, toolMap }    = buildIntegrationTools(contexts);
  const allTools                        = [...BUILTIN_TOOLS, ...intTools];

  const { rows: history } = await pool.query(
    "SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20",
    [conversationId]
  );
  const historyMessages = history.reverse().slice(0, -1);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const systemPrompt =
    `You are a helpful personal AI assistant with access to web search and the user's connected apps.\n` +
    `Today is ${today}.` +
    (contextBlock ? "\n\nYou have the following data from connected apps:" + contextBlock : "") +
    `\n\nWhen you need current information, use the web_search tool. When the user asks to create/update/delete data, use the integration tools. Answer in the same language the user writes in.`;

  const openai = new OpenAI({ apiKey });
  const steps  = []; // collected tool call steps to return to frontend

  let messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    {
      role: "user",
      content: imageBase64
        ? [
            ...(textContent ? [{ type: "text", text: textContent }] : []),
            { type: "image_url", image_url: { url: `data:${imageMimeType || "image/png"};base64,${imageBase64}`, detail: "auto" } },
          ]
        : textContent,
    },
  ];

  try {
    // ── Tool calling loop (up to 5 rounds) ───────────────────────────────────
    let finalReply = null;

    for (let round = 0; round < 5; round++) {
      const response = await openai.chat.completions.create({
        model,
        messages,
        tools:                allTools,
        tool_choice:          "auto",
        max_completion_tokens: 4000,
      });

      const choice = response.choices[0];

      if (choice.finish_reason !== "tool_calls") {
        finalReply = choice.message.content;
        break;
      }

      // Execute all tool calls in this round
      const toolCalls = choice.message.tool_calls;
      const toolResults = await Promise.all(
        toolCalls.map(async tc => {
          const args   = JSON.parse(tc.function.arguments);
          const result = await executeTool(tc.function.name, args, toolMap);
          console.log(`[tool] ${tc.function.name}(${JSON.stringify(args).slice(0, 80)}) →`, JSON.stringify(result).slice(0, 120));

          // Collect step for frontend
          steps.push({
            toolName:    tc.function.name,
            displayName: toolDisplayName(tc.function.name, args),
            args,
            result,
            success:     !result.error,
          });

          return { tool_call_id: tc.id, result };
        })
      );

      // Append tool calls + results to messages for next round
      messages = [
        ...messages,
        choice.message,
        ...toolResults.map(tr => ({
          role:         "tool",
          tool_call_id: tr.tool_call_id,
          content:      JSON.stringify(tr.result),
        })),
      ];
    }

    if (!finalReply) finalReply = "I was unable to complete the request after multiple steps.";

    await pool.query(
      "INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)",
      [conversationId, finalReply]
    );

    if (historyMessages.length === 0) {
      await pool.query("UPDATE conversations SET title=$1 WHERE id=$2",
        [(textContent || "Image").slice(0, 60) + ((textContent || "Image").length > 60 ? "…" : ""), conversationId]);
    }

    res.json({ reply: finalReply, steps });

  } catch (err) {
    console.error("OpenAI error:", err.message);
    const errMsg = `❌ OpenAI error: ${err.message}`;
    await pool.query("INSERT INTO messages (conversation_id,role,content) VALUES ($1,'assistant',$2)", [conversationId, errMsg]);
    res.json({ reply: errMsg, steps });
  }
});

export default router;
