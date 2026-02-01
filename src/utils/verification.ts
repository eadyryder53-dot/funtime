import crypto from "crypto";

const CODE_BYTES = 16;
const CODE_TTL_MS = 15 * 60 * 1000;

export type VerificationPayload = {
  code: string;
  expiresAt: Date;
};

export function generateVerificationCode(): VerificationPayload {
  const code = crypto.randomBytes(CODE_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  return { code, expiresAt };
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
