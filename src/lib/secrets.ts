import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function key() {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL ? "preview-only-do-not-use-in-production-64f8ad" : undefined);
  if (!secret || secret.length < 32) throw new Error("Set a 32+ character AUTH_SECRET before saving provider keys");
  return createHash("sha256").update(secret).digest();
}
export function encrypt(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}
export function decrypt(value: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1") throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
