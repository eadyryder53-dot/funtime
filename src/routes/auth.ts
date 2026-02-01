import type { Request, Response } from "express";
import { Router } from "express";
import { AuthSecretModel } from "../models/AuthSecret";
import { UserModel } from "../models/User";
import { antiAbuse } from "../middleware/antiAbuse";
import { rateLimit } from "../middleware/rateLimit";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateAccessToken, generateRefreshToken, hashToken, safeTokenCompare } from "../utils/tokens";
import { generateVerificationCode, hashVerificationCode } from "../utils/verification";
import crypto from "crypto";

const router = Router();

const signupLimiter = rateLimit({ keyPrefix: "auth:signup", windowMs: 15 * 60 * 1000, max: 10 });
const loginLimiter = rateLimit({ keyPrefix: "auth:login", windowMs: 15 * 60 * 1000, max: 20 });
const refreshLimiter = rateLimit({ keyPrefix: "auth:refresh", windowMs: 5 * 60 * 1000, max: 30 });
const verifyLimiter = rateLimit({ keyPrefix: "auth:verify", windowMs: 10 * 60 * 1000, max: 15 });

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase();
}

function normalizePhone(phone?: string) {
  return phone?.replace(/\s+/g, "");
}

function hashIdentifier(value?: string) {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function issueRefreshToken(userId: string, deviceId: string) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await AuthSecretModel.updateOne(
    { userId },
    {
      $push: {
        refreshTokens: {
          tokenHash,
          deviceId,
          createdAt: new Date(),
          expiresAt,
        },
      },
    }
  );

  return { refreshToken, tokenHash, expiresAt };
}

router.post("/signup", antiAbuse, signupLimiter, async (req: Request, res: Response) => {
  const { username, password, email, phone, deviceId, publicKey } = req.body ?? {};

  if (!username || !password || !deviceId) {
    return res.status(400).json({ error: "username, password, and deviceId are required." });
  }

  const existingUser = await UserModel.findOne({ username }).lean();
  if (existingUser) {
    return res.status(409).json({ error: "Username already in use." });
  }

  const { hash, algorithm } = await hashPassword(password);

  const user = await UserModel.create({
    username,
    publicKeys: publicKey ? [publicKey] : [],
    deviceIds: [deviceId],
  });

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const emailHash = hashIdentifier(normalizedEmail);
  const phoneHash = hashIdentifier(normalizedPhone);

  const emailVerification = normalizedEmail ? generateVerificationCode() : undefined;
  const phoneVerification = normalizedPhone ? generateVerificationCode() : undefined;

  await AuthSecretModel.create({
    userId: user._id,
    passwordHash: hash,
    passwordAlgo: algorithm,
    emailHash,
    phoneHash,
    verification: {
      emailCodeHash: emailVerification ? hashVerificationCode(emailVerification.code) : undefined,
      emailCodeExpiresAt: emailVerification?.expiresAt,
      phoneCodeHash: phoneVerification ? hashVerificationCode(phoneVerification.code) : undefined,
      phoneCodeExpiresAt: phoneVerification?.expiresAt,
    },
  });

  const accessToken = generateAccessToken();
  const refreshPayload = await issueRefreshToken(user._id.toString(), deviceId);

  return res.status(201).json({
    userId: user._id,
    accessToken,
    refreshToken: refreshPayload.refreshToken,
    verification: {
      emailSent: Boolean(emailVerification),
      phoneSent: Boolean(phoneVerification),
    },
  });
});

router.post("/login", antiAbuse, loginLimiter, async (req: Request, res: Response) => {
  const { username, password, deviceId, publicKey } = req.body ?? {};
  if (!username || !password || !deviceId) {
    return res.status(400).json({ error: "username, password, and deviceId are required." });
  }

  const user = await UserModel.findOne({ username }).lean();
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const authSecret = await AuthSecretModel.findOne({ userId: user._id });
  if (!authSecret) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const ok = await verifyPassword(password, authSecret.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $addToSet: {
        deviceIds: deviceId,
        publicKeys: publicKey,
      },
    }
  );

  const accessToken = generateAccessToken();
  const refreshPayload = await issueRefreshToken(user._id.toString(), deviceId);

  return res.status(200).json({
    userId: user._id,
    accessToken,
    refreshToken: refreshPayload.refreshToken,
  });
});

router.post("/refresh", antiAbuse, refreshLimiter, async (req: Request, res: Response) => {
  const { refreshToken, deviceId, userId } = req.body ?? {};
  if (!refreshToken || !deviceId || !userId) {
    return res.status(400).json({ error: "refreshToken, deviceId, and userId are required." });
  }

  const authSecret = await AuthSecretModel.findOne({ userId });
  if (!authSecret) {
    return res.status(401).json({ error: "Invalid session." });
  }

  const refreshTokenHash = hashToken(refreshToken);
  const tokenRecord = authSecret.refreshTokens.find(
    (token) => token.deviceId === deviceId && safeTokenCompare(token.tokenHash, refreshTokenHash)
  );

  if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt <= new Date()) {
    return res.status(401).json({ error: "Invalid session." });
  }

  tokenRecord.revokedAt = new Date();
  tokenRecord.lastUsedAt = new Date();
  await authSecret.save();

  const accessToken = generateAccessToken();
  const refreshPayload = await issueRefreshToken(userId, deviceId);

  return res.status(200).json({
    accessToken,
    refreshToken: refreshPayload.refreshToken,
  });
});

router.post("/verify/email", antiAbuse, verifyLimiter, async (req: Request, res: Response) => {
  const { userId, code } = req.body ?? {};
  if (!userId || !code) {
    return res.status(400).json({ error: "userId and code are required." });
  }

  const authSecret = await AuthSecretModel.findOne({ userId });
  if (!authSecret?.verification?.emailCodeHash) {
    return res.status(404).json({ error: "No pending email verification." });
  }

  if (authSecret.verification.emailCodeExpiresAt && authSecret.verification.emailCodeExpiresAt < new Date()) {
    return res.status(410).json({ error: "Verification code expired." });
  }

  const codeHash = hashVerificationCode(code);
  if (!safeTokenCompare(authSecret.verification.emailCodeHash, codeHash)) {
    return res.status(401).json({ error: "Invalid verification code." });
  }

  authSecret.verification.emailVerifiedAt = new Date();
  authSecret.verification.emailCodeHash = undefined;
  authSecret.verification.emailCodeExpiresAt = undefined;
  await authSecret.save();

  return res.status(200).json({ verified: true });
});

router.post("/verify/phone", antiAbuse, verifyLimiter, async (req: Request, res: Response) => {
  const { userId, code } = req.body ?? {};
  if (!userId || !code) {
    return res.status(400).json({ error: "userId and code are required." });
  }

  const authSecret = await AuthSecretModel.findOne({ userId });
  if (!authSecret?.verification?.phoneCodeHash) {
    return res.status(404).json({ error: "No pending phone verification." });
  }

  if (authSecret.verification.phoneCodeExpiresAt && authSecret.verification.phoneCodeExpiresAt < new Date()) {
    return res.status(410).json({ error: "Verification code expired." });
  }

  const codeHash = hashVerificationCode(code);
  if (!safeTokenCompare(authSecret.verification.phoneCodeHash, codeHash)) {
    return res.status(401).json({ error: "Invalid verification code." });
  }

  authSecret.verification.phoneVerifiedAt = new Date();
  authSecret.verification.phoneCodeHash = undefined;
  authSecret.verification.phoneCodeExpiresAt = undefined;
  await authSecret.save();

  return res.status(200).json({ verified: true });
});

router.post("/logout", antiAbuse, refreshLimiter, async (req: Request, res: Response) => {
  const { refreshToken, deviceId, userId } = req.body ?? {};
  if (!refreshToken || !deviceId || !userId) {
    return res.status(400).json({ error: "refreshToken, deviceId, and userId are required." });
  }

  const authSecret = await AuthSecretModel.findOne({ userId });
  if (!authSecret) {
    return res.status(200).json({ success: true });
  }

  const refreshTokenHash = hashToken(refreshToken);
  const tokenRecord = authSecret.refreshTokens.find(
    (token) => token.deviceId === deviceId && safeTokenCompare(token.tokenHash, refreshTokenHash)
  );

  if (tokenRecord && !tokenRecord.revokedAt) {
    tokenRecord.revokedAt = new Date();
    await authSecret.save();
  }

  return res.status(200).json({ success: true });
});

export default router;
