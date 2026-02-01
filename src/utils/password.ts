import argon2 from "argon2";

export type PasswordHash = {
  hash: string;
  algorithm: "argon2id";
};

export async function hashPassword(password: string): Promise<PasswordHash> {
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 64 * 1024,
    parallelism: 2,
  });

  return { hash, algorithm: "argon2id" };
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
