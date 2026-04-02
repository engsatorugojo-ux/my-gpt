import express from "express";
import cors from "cors";
import { waitForDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import conversationsRoutes from "./routes/conversations.js";
import chatRoutes from "./routes/chat.js";
import integrationsRoutes from "./routes/integrations.js";
import settingsRoutes     from "./routes/settings.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "20mb" }));
app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api/auth",          authRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/chat",          chatRoutes);
app.use("/api/integrations",  integrationsRoutes);
app.use("/api/settings",      settingsRoutes);

waitForDb()
  .then(() => app.listen(process.env.PORT || 4002, () =>
    console.log(`my-gpt backend on port ${process.env.PORT || 4002}`)))
  .catch(err => { console.error(err.message); process.exit(1); });
