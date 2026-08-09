import crypto from "node:crypto";
import { env } from "@/config/env.js";

export function verifyGitHubSignature(payload: string, signature: string): boolean {
  if (!env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", env.GITHUB_WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
