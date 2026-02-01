import crypto from "crypto";

const REFRESH_TOKEN_BYTES = 64;
const ACCESS_TOKEN_BYTES = 32;
const HASH_DIGEST = "sha256";

export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

export function generateAccessToken(): string {
  return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash(HASH_DIGEST).update(token).digest("hex");
}

export function safeTokenCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
