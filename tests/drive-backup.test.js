import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { encryptSnapshot } from "../server/backup.js";
import {
  driveConfigured,
  driveRetention,
  mirrorDriveBackup,
} from "../server/drive-backup.js";
const TAG = "gurukit-encrypted-v1";
const env = {
  GOOGLE_DRIVE_CLIENT_ID: "client",
  GOOGLE_DRIVE_CLIENT_SECRET: "secret",
  GOOGLE_DRIVE_REFRESH_TOKEN: "refresh",
  BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
};
const snapshot = {
  version: 1,
  kind: "gurukit-application",
  createdAt: "2026-11-12T00:00:00Z",
  tables: {
    profiles: [{ id: "SYNTHETIC_PRIVATE_VALUE" }],
    quota_usage: [],
    saved_documents: [],
    rph_templates: [],
    question_banks: [],
  },
};
const encrypted = encryptSnapshot(snapshot, env.BACKUP_ENCRYPTION_KEY);
function mock({
  badDownload = false,
  authError = false,
  conflict = false,
  files = [],
  existing = false,
  unsafeUploadLocation = false,
  newFolder = false,
} = {}) {
  const calls = [];
  let fileIndex = 0;
  const uploaded = [];
  let pendingName;
  const json = (d) =>
    new Response(JSON.stringify(d), {
      headers: { "Content-Type": "application/json" },
    });
  const metadata = (name, kind, id) => ({
    id,
    name,
    mimeType: "application/octet-stream",
    size: String(encrypted.length),
    md5Checksum: conflict
      ? "wrong"
      : createHash("md5").update(encrypted).digest("hex"),
    appProperties: { gurukitBackup: TAG, kind },
  });
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const u = new URL(url);
    if (u.hostname === "oauth2.googleapis.com")
      return authError
        ? new Response("{}", { status: 401 })
        : json({ access_token: "ACCESS_TOKEN" });
    if (u.pathname === "/drive/v3/files" && !options.method) {
      const q = u.searchParams.get("q");
      if (q.includes("mimeType ="))
        return json({ files: newFolder ? [] : [{ id: "APP_FOLDER" }] });
      return json({
        files: [
          ...files,
          ...(existing
            ? [metadata("gurukit-daily-2026-11-12.enc", "daily", "EXISTING")]
            : []),
        ],
      });
    }
    if (u.pathname === "/drive/v3/files" && options.method === "POST") {
      const folder = JSON.parse(options.body);
      assert.equal(folder.mimeType, "application/vnd.google-apps.folder");
      assert.equal(folder.appProperties.gurukitBackup, TAG);
      return json({ id: "APP_FOLDER" });
    }
    if (u.pathname === "/upload/drive/v3/files") {
      if (options.method === "POST") {
        pendingName = JSON.parse(options.body).name;
        return new Response("", {
          headers: {
            Location: unsafeUploadLocation
              ? "https://untrusted.invalid/upload"
              : "https://www.googleapis.com/upload/drive/v3/files?upload_id=TEST",
          },
        });
      }
      assert.equal(options.method, "PUT");
      assert.deepEqual(options.body, encrypted);
      assert.equal(
        options.body.includes(Buffer.from("SYNTHETIC_PRIVATE_VALUE")),
        false,
      );
      const name = pendingName,
        kind = name.includes("weekly") ? "weekly" : "daily";
      const item = metadata(name, kind, "FILE_" + ++fileIndex);
      uploaded.push(item);
      return json(item);
    }
    if (u.searchParams.get("alt") === "media")
      return new Response(badDownload ? Buffer.from("tampered") : encrypted);
    if (options.method === "PATCH")
      return json({ id: u.pathname.split("/").at(-1) });
    throw Error("Unexpected mocked request " + url);
  };
  return { fetchImpl, calls, uploaded };
}
test("Drive stays disabled without OAuth bindings and rejects partial configuration", async () => {
  assert.equal(driveConfigured({}), false);
  assert.deepEqual(await mirrorDriveBackup(encrypted, "2026-11-12", {}), {
    status: "not_configured",
  });
  await assert.rejects(
    mirrorDriveBackup(encrypted, "2026-11-12", {
      GOOGLE_DRIVE_CLIENT_ID: "client",
    }),
    /CONFIG_INCOMPLETE/,
  );
});
test("Drive verifies the uploaded ciphertext through authenticated decryption", async () => {
  const m = mock();
  const result = await mirrorDriveBackup(
    encrypted,
    "2026-11-12",
    env,
    m.fetchImpl,
  );
  assert.equal(result.status, "verified");
  assert.equal(m.uploaded.length, 1);
  assert.equal(result.copies, 1);
  assert.ok(m.calls.some((x) => x.url.includes("alt=media")));
});
test("Sunday keeps a separate weekly archive", async () => {
  const m = mock();
  const result = await mirrorDriveBackup(
    encrypted,
    "2026-11-15",
    env,
    m.fetchImpl,
  );
  assert.equal(result.copies, 2);
  assert.equal(m.uploaded.length, 2);
  assert.ok(m.uploaded.some((x) => x.name === "gurukit-weekly-2026-11-15.enc"));
});
test("same-day retry verifies existing file without duplicate uploads", async () => {
  const m = mock({ existing: true });
  assert.equal(
    (await mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl)).status,
    "verified",
  );
  assert.equal(m.uploaded.length, 0);
});
test("unexpected same-day content is not overwritten or pruned", async () => {
  const m = mock({ existing: true, conflict: true });
  await assert.rejects(
    mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl),
    /BACKUP_CONFLICT/,
  );
  assert.equal(
    m.calls.some(
      (x) =>
        ["PATCH", "POST"].includes(x.options.method) &&
        !x.url.includes("oauth2"),
    ),
    false,
  );
});
test("Drive rejects tampered readback before retention changes", async () => {
  const m = mock({ badDownload: true });
  await assert.rejects(
    mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl),
  );
  assert.equal(
    m.calls.some((x) => x.options.method === "PATCH"),
    false,
  );
});
test("OAuth failure never uploads data and does not reveal credentials", async () => {
  const m = mock({ authError: true });
  await assert.rejects(
    mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl),
    /^Error: DRIVE_AUTH_FAILED$/,
  );
  assert.equal(m.calls.length, 1);
});
test("retention only selects our dated tagged archives beyond seven daily and four weekly copies", () => {
  const make = (kind, n) => ({
    id: kind + n,
    name: `gurukit-${kind}-2026-10-${String(n).padStart(2, "0")}.enc`,
    appProperties: { gurukitBackup: TAG, kind },
  });
  const daily = Array.from({ length: 10 }, (_, i) => make("daily", i + 1)),
    weekly = Array.from({ length: 6 }, (_, i) => make("weekly", i + 1));
  const unrelated = [
    { ...make("daily", 1), appProperties: {} },
    {
      id: "private",
      name: "family-photo.jpg",
      appProperties: { gurukitBackup: TAG },
    },
  ];
  const expired = driveRetention([...daily, ...weekly, ...unrelated]);
  assert.deepEqual(
    expired.map((x) => x.id),
    ["daily3", "daily2", "daily1", "weekly2", "weekly1"],
  );
});
test("Drive only trashes expired app-owned backups after verification", async () => {
  const files = Array.from({ length: 8 }, (_, i) => ({
    id: "OLD_" + i,
    name: `gurukit-daily-2026-10-${String(i + 1).padStart(2, "0")}.enc`,
    appProperties: { gurukitBackup: TAG, kind: "daily" },
  }));
  const m = mock({ files });
  await mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl);
  const changes = m.calls.filter((x) => x.options.method === "PATCH");
  assert.equal(changes.length, 2);
  assert.ok(changes.every((x) => JSON.parse(x.options.body).trashed === true));
  assert.ok(
    m.calls.findIndex((x) => x.url.includes("alt=media")) <
      m.calls.findIndex((x) => x.options.method === "PATCH"),
  );
});
test("malformed encrypted backup is rejected before any Google request", async () => {
  const m = mock();
  await assert.rejects(
    mirrorDriveBackup(Buffer.from("plaintext"), "2026-11-12", env, m.fetchImpl),
  );
  assert.equal(m.calls.length, 0);
});

test("initial connection creates an app-tagged folder without accessing other folders", async () => {
  const m = mock({ newFolder: true });
  assert.equal(
    (await mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl)).status,
    "verified",
  );
  assert.ok(
    m.calls.some(
      (x) =>
        x.url.includes("/drive/v3/files?fields=id") &&
        x.options.method === "POST",
    ),
  );
});
test("upload session cannot redirect OAuth credentials or ciphertext to another host", async () => {
  const m = mock({ unsafeUploadLocation: true });
  await assert.rejects(
    mirrorDriveBackup(encrypted, "2026-11-12", env, m.fetchImpl),
    /LOCATION_INVALID/,
  );
  assert.equal(
    m.calls.some((x) => x.options.method === "PUT"),
    false,
  );
});
