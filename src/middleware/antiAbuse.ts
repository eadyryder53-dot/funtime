import type { Request, Response, NextFunction } from "express";

const REQUIRED_TOKEN_HEADER = "x-anti-abuse-token";

export function antiAbuse(req: Request, res: Response, next: NextFunction) {
  const requiredToken = process.env.ANTI_ABUSE_TOKEN;
  if (!requiredToken) {
    return next();
  }

  const provided = req.header(REQUIRED_TOKEN_HEADER);
  if (!provided || provided !== requiredToken) {
    return res.status(403).json({ error: "Anti-abuse token missing or invalid." });
  }

  return next();
}
