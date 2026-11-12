import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
export const BACKUP_TABLES = [
  "profiles",
  "quota_usage",
  "saved_documents",
  "rph_templates",
  "question_banks",
];
const MAX = 8 * 1024 * 1024,
  AAD = Buffer.from("GuruKit application backup v1");
function keyBytes(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("BACKUP_KEY_REQUIRED");
  return Buffer.from(value, "hex");
}
export function validateSnapshot(data) {
  if (
    !data ||
    data.version !== 1 ||
    data.kind !== "gurukit-application" ||
    !data.tables ||
    !data.createdAt ||
    Number.isNaN(Date.parse(data.createdAt))
  )
    throw new Error("INVALID_BACKUP");
  if (
    Object.keys(data.tables).length !== BACKUP_TABLES.length ||
    BACKUP_TABLES.some(
      (name) =>
        !Array.isArray(data.tables[name]) ||
        data.tables[name].some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        ),
    )
  )
    throw new Error("INVALID_BACKUP_TABLES");
  const bytes = Buffer.from(JSON.stringify(data));
  if (bytes.length > MAX + 65536) throw new Error("BACKUP_TOO_LARGE");
  return bytes;
}
export function encryptSnapshot(snapshot, key) {
  const plain = validateSnapshot(snapshot),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return Buffer.from(
    JSON.stringify({
      version: 1,
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      data: data.toString("base64"),
    }),
  );
}
export function decryptSnapshot(encrypted, key) {
  if (encrypted.length > 12 * 1024 * 1024) throw new Error("BACKUP_TOO_LARGE");
  const envelope = JSON.parse(encrypted.toString());
  if (
    envelope.version !== 1 ||
    !/^[a-f0-9]{24}$/i.test(envelope.iv) ||
    !/^[a-f0-9]{32}$/i.test(envelope.tag) ||
    typeof envelope.data !== "string"
  )
    throw new Error("INVALID_ENVELOPE");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(key),
    Buffer.from(envelope.iv, "hex"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  const data = JSON.parse(
    gunzipSync(compressed, { maxOutputLength: MAX + 65536 }).toString(),
  );
  validateSnapshot(data);
  return data;
}
export function snapshotDigest(snapshot) {
  return createHash("sha256").update(validateSnapshot(snapshot)).digest("hex");
}
