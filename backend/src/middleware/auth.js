import jwt from "jsonwebtoken";
export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try { req.userId = jwt.verify(h.slice(7), process.env.JWT_SECRET).userId; next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}
