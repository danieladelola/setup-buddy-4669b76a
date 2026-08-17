// AWS SNS HTTP/S signature verification.
// Implements: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
//
// Rules enforced:
//  - SigningCertURL must be HTTPS and host must match sns.<region>.amazonaws.com[.cn]
//  - Canonical string-to-sign is built per message type (Notification vs *Confirmation)
//  - Signature is verified with RSA-SHA1 (v1) or RSA-SHA256 (v2)
//  - Cert is fetched once and cached per process

import { createVerify, type KeyObject, createPublicKey } from "crypto";

const SIGNING_HOST_RE = /^sns\.[a-zA-Z0-9-]+\.amazonaws\.com(?:\.cn)?$/;

const certCache = new Map<string, KeyObject>();

type SnsMessage = Record<string, unknown> & {
  Type?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  MessageId?: string;
  Timestamp?: string;
  TopicArn?: string;
  Message?: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

function assertSigningCertUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid SigningCertURL");
  }
  if (parsed.protocol !== "https:") throw new Error("SigningCertURL not https");
  if (!SIGNING_HOST_RE.test(parsed.hostname)) {
    throw new Error(`SigningCertURL host not allowed: ${parsed.hostname}`);
  }
  return parsed;
}

async function getPublicKey(certUrl: string): Promise<KeyObject> {
  const cached = certCache.get(certUrl);
  if (cached) return cached;
  const parsed = assertSigningCertUrl(certUrl);
  const res = await fetch(parsed.toString());
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
  const pem = await res.text();
  if (!pem.includes("BEGIN CERTIFICATE")) throw new Error("cert not PEM");
  const key = createPublicKey(pem);
  certCache.set(certUrl, key);
  return key;
}

function fieldsForType(type: string): string[] {
  // Order matters — these are the canonical SNS signing fields per type.
  if (type === "Notification") {
    return ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
  }
  if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
    return ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  }
  throw new Error(`unsupported SNS type: ${type}`);
}

function buildStringToSign(msg: SnsMessage): string {
  const fields = fieldsForType(String(msg.Type));
  let s = "";
  for (const f of fields) {
    const v = msg[f as keyof SnsMessage];
    if (v === undefined || v === null) continue; // Subject is optional for Notification
    s += `${f}\n${String(v)}\n`;
  }
  return s;
}

export type SnsVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function verifySnsMessage(msg: SnsMessage): Promise<SnsVerifyResult> {
  try {
    if (!msg || typeof msg !== "object") return { ok: false, reason: "missing body" };
    if (!msg.Type || !msg.Signature || !msg.SigningCertURL || !msg.SignatureVersion) {
      return { ok: false, reason: "missing signature fields" };
    }
    const version = String(msg.SignatureVersion);
    if (version !== "1" && version !== "2") {
      return { ok: false, reason: `unsupported SignatureVersion ${version}` };
    }
    const key = await getPublicKey(String(msg.SigningCertURL));
    const algo = version === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const verifier = createVerify(algo);
    verifier.update(buildStringToSign(msg), "utf8");
    verifier.end();
    const sigBuf = Buffer.from(String(msg.Signature), "base64");
    const valid = verifier.verify(key, sigBuf);
    return valid ? { ok: true } : { ok: false, reason: "signature invalid" };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "verify error" };
  }
}
