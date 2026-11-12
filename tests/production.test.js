import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createCipheriv } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  encryptSnapshot,
  decryptSnapshot,
  snapshotDigest,
  validateSnapshot,
} from "../server/backup.js";
import {
  secretMatches,
  safeOperationalEvent,
  rateResponse,
} from "../server/operational.js";
import opsHandler from "../api/operations.js";
import statusHandler from "../api/ops-status.js";
import clientError from "../api/client-error.js";
const data = {
  version: 1,
  kind: "gurukit-application",
  createdAt: "2026-11-12T01:00:00Z",
  tables: {
    profiles: [{ id: "synthetic", full_name: "VERY_PRIVATE_TEST_CONTENT" }],
    quota_usage: [],
    saved_documents: [],
    rph_templates: [],
    question_banks: [],
  },
};
const key = randomBytes(32).toString("hex");
const response = () => ({
  headers: {},
  statusCode: 200,
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(s) {
    this.statusCode = s;
    return this;
  },
  json(v) {
    this.body = v;
    return this;
  },
});
test("application backup round trip authenticated encryption and digest", () => {
  const encrypted = encryptSnapshot(data, key);
  assert.ok(!encrypted.toString().includes("VERY_PRIVATE_TEST_CONTENT"));
  assert.deepEqual(decryptSnapshot(encrypted, key), data);
  assert.equal(
    snapshotDigest(data),
    snapshotDigest(decryptSnapshot(encrypted, key)),
  );
});
test("backup encryption uses fresh random nonces", () => {
  assert.notDeepEqual(encryptSnapshot(data, key), encryptSnapshot(data, key));
});
test("wrong keys and tampering fail closed", () => {
  const encrypted = encryptSnapshot(data, key);
  assert.throws(() =>
    decryptSnapshot(encrypted, randomBytes(32).toString("hex")),
  );
  const changed = JSON.parse(encrypted);
  changed.tag = (changed.tag[0] === "a" ? "b" : "a") + changed.tag.slice(1);
  assert.throws(() =>
    decryptSnapshot(Buffer.from(JSON.stringify(changed)), key),
  );
});
test("backup key and shape restrictions", () => {
  assert.throws(() => encryptSnapshot(data, "weak"));
  assert.throws(() => validateSnapshot({ ...data, version: 2 }));
  assert.throws(() => validateSnapshot({ ...data, tables: { profiles: [] } }));
  assert.throws(() => decryptSnapshot(Buffer.from("{}"), key));
});
test("backup decompression has an output ceiling", () => {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from("GuruKit application backup v1"));
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(Buffer.alloc(9 * 1024 * 1024, 65))),
    cipher.final(),
  ]);
  const envelope = Buffer.from(
    JSON.stringify({
      version: 1,
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      data: encrypted.toString("base64"),
    }),
  );
  assert.throws(() => decryptSnapshot(envelope, key));
});
test("operations secret comparison rejects missing, weak and mismatched tokens", () => {
  assert.equal(secretMatches("Bearer " + key, key), true);
  for (const [header, secret] of [
    [undefined, key],
    ["Bearer " + key, undefined],
    ["Bearer " + key, "weak"],
    ["Bearer other", key],
  ])
    assert.equal(secretMatches(header, secret), false);
});
test("operational events drop all input, credential and message fields", () => {
  const row = safeOperationalEvent({
    event: "generation_error",
    code: "GENERATION_FAILED",
    requestId: "not-uuid",
    actorId: "not-uuid",
    toolId: "rph-kssm",
    durationMs: 500000,
    prompt: "PRIVATE",
    token: "SECRET",
    email: "secret@example.invalid",
    message: "sensitive",
  });
  assert.deepEqual(Object.keys(row).sort(), [
    "actor_id",
    "code",
    "duration_ms",
    "event",
    "request_id",
    "tool_id",
  ]);
  assert.equal(row.request_id, null);
  assert.equal(row.duration_ms, 120000);
  assert.ok(!JSON.stringify(row).includes("PRIVATE"));
  assert.throws(() =>
    safeOperationalEvent({ event: "unexpected", code: "OK" }),
  );
  assert.throws(() =>
    safeOperationalEvent({ event: "client_error", code: "token=secret" }),
  );
});
test("rate and maintenance responses are safe and classified", () => {
  assert.equal(rateResponse("GURUR").status, 429);
  assert.equal(rateResponse("GURUC").code, "CONCURRENCY_LIMIT");
  assert.equal(rateResponse("GURUB").status, 503);
  assert.equal(rateResponse("GURUM").code, "MAINTENANCE");
  assert.equal(rateResponse("unknown"), null);
});
test("operations endpoints require a valid secret", async () => {
  for (const handler of [opsHandler, statusHandler]) {
    const res = response();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "UNAUTHORIZED");
  }
});
test("client reporting requires authentication before reading body", async () => {
  const res = response();
  await clientError(
    {
      method: "POST",
      headers: {},
      body: { code: "UI_RENDER_ERROR", message: "sensitive" },
    },
    res,
  );
  assert.equal(res.statusCode, 401);
});
test("client reporting rejects raw messages and unknown codes", async () => {
  for (const body of [
    { code: "UI_RENDER_ERROR", message: "PRIVATE" },
    { code: "PRIVATE" },
    "{",
  ]) {
    const res = response();
    await clientError(
      { method: "POST", headers: { authorization: "Bearer test" }, body },
      res,
    );
    assert.equal(res.statusCode, 400);
  }
});

const { runOperations } = await import("../server/operations.js");
const { createHealthHandler } = await import("../api/health.js");
function mockOperations(options = {}) {
  let stored = null;
  const states = [];
  const bucket = {
    upload: async (name, bytes) => {
      stored = bytes;
      return { error: options.uploadError ? {} : null };
    },
    download: async () => ({ data: new Blob([stored]), error: null }),
    list: async () => ({ data: [], error: null }),
    remove: async () => ({ error: null }),
  };
  const admin = {
    rpc: async (name) =>
      name === "claim_operations_run"
        ? { data: !options.already }
        : name === "application_backup_snapshot"
          ? { data }
          : { data: {} },
    storage: { from: () => bucket },
    from: () => ({
      update: (row) => ({
        eq: async () => {
          states.push(row.state);
          return { error: null };
        },
      }),
      insert: () => ({ abortSignal: async () => ({ error: null }) }),
    }),
  };
  return { admin, states, getStored: () => stored };
}
test("daily operation uploads, downloads and verifies encrypted application backup", async () => {
  const f = mockOperations();
  const result = await runOperations(f.admin, {
    BACKUP_ENCRYPTION_KEY: key,
    VERCEL_GIT_COMMIT_SHA: "test-release",
  });
  assert.equal(result.verified, true);
  assert.equal(result.scope, "application-data-only");
  assert.deepEqual(f.states, ["completed"]);
  assert.equal(decryptSnapshot(f.getStored(), key).release, "test-release");
});
test("daily operations are idempotent and do not overwrite completed backups", async () => {
  const f = mockOperations({ already: true });
  const result = await runOperations(f.admin, { BACKUP_ENCRYPTION_KEY: key });
  assert.equal(result.status, "already_claimed");
  assert.equal(f.getStored(), null);
});
test("failed backup upload never claims verified success", async () => {
  const f = mockOperations({ uploadError: true });
  await assert.rejects(
    () => runOperations(f.admin, { BACKUP_ENCRYPTION_KEY: key }),
    /BACKUP_UPLOAD_FAILED/,
  );
  assert.deepEqual(f.states, ["failed"]);
});
test("health exposes only status, version and timestamp", async () => {
  const handler = createHealthHandler(() => ({
    rpc: async () => ({
      data: {
        database: true,
        generationEnabled: true,
        attemptsToday: 1,
        attemptLimit: 500,
        secret: "DO_NOT_LEAK",
      },
    }),
  }));
  const res = response();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.ok(!JSON.stringify(res.body).includes("DO_NOT_LEAK"));
});
test("health is unavailable on database failure and degraded at attempt budget", async () => {
  for (const data of [
    null,
    {
      database: true,
      generationEnabled: true,
      attemptsToday: 500,
      attemptLimit: 500,
    },
  ]) {
    const res = response();
    await createHealthHandler(() => ({
      rpc: async () => ({ data, error: data ? null : {} }),
    }))({ method: "GET" }, res);
    assert.equal(res.statusCode, 503);
  }
});
