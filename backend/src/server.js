import "./env.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import auth from "./routes/auth.js";
import dashboard from "./routes/dashboard.js";
import contacts from "./routes/contacts.js";
import lists from "./routes/lists.js";
import templates from "./routes/templates.js";
import campaigns from "./routes/campaigns.js";
import tracking from "./routes/tracking.js";
import unsubscribe from "./routes/unsubscribe.js";
import sns from "./routes/sns.js";
import settings from "./routes/settings.js";
import deliverability from "./routes/deliverability.js";
import analytics from "./routes/analytics.js";

const app = express();

const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(morgan("tiny"));
// JSON for most routes; SNS route reads raw body itself.
app.use((req, res, next) => {
  if (req.path === "/sns" || req.path === "/api/webhooks/sns") return next();
  express.json({ limit: "5mb" })(req, res, next);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", auth);
app.use("/api/dashboard", dashboard);
app.use("/api/contacts", contacts);
app.use("/api/lists", lists);
app.use("/api/templates", templates);
app.use("/api/campaigns", campaigns);
app.use("/api/settings", settings);
app.use("/api/deliverability", deliverability);
app.use("/api/analytics", analytics);

// Public (no auth)
app.use("/t", tracking);
app.use("/", unsubscribe);
app.use("/", sns);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, () => console.log(`API listening on :${port}`));
