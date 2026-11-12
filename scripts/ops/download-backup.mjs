import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decryptSnapshot, snapshotDigest } from "../../server/backup.js";
const directory = process.argv[2];
if (!directory)
  throw new Error("Specify a private output directory outside the repository.");
if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.BACKUP_ENCRYPTION_KEY
)
  throw new Error("Secure backup environment bindings are required.");
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const bucket = admin.storage.from("gurukit-backups"),
  list = await bucket.list("", {
    limit: 100,
    sortBy: { column: "name", order: "desc" },
  });
if (list.error) throw new Error("BACKUP_LIST_FAILED");
const item = list.data.find((x) => /^app-\d{4}-\d{2}-\d{2}\.enc$/.test(x.name));
if (!item) throw new Error("NO_BACKUP");
const result = await bucket.download(item.name);
if (result.error) throw new Error("BACKUP_DOWNLOAD_FAILED");
const encrypted = Buffer.from(await result.data.arrayBuffer()),
  snapshot = decryptSnapshot(encrypted, process.env.BACKUP_ENCRYPTION_KEY);
await mkdir(directory, { recursive: true, mode: 0o700 });
const file = resolve(directory, item.name);
try {
  await writeFile(file, encrypted, { mode: 0o600, flag: "wx" });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const existing = decryptSnapshot(
    await readFile(file),
    process.env.BACKUP_ENCRYPTION_KEY,
  );
  if (snapshotDigest(existing) !== snapshotDigest(snapshot))
    throw new Error("REFUSING_TO_OVERWRITE_DIFFERENT_BACKUP");
}
console.log(
  JSON.stringify({
    status: "downloaded_and_verified",
    file,
    scope: "application-data-only",
    bytes: encrypted.length,
  }),
);
