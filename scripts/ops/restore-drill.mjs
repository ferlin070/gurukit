// This drill only restores to a disposable local Docker PostgreSQL, never a remote database.
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import {
  decryptSnapshot,
  encryptSnapshot,
  BACKUP_TABLES,
} from "../../server/backup.js";
const dockerEnv = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete dockerEnv[key];
const docker = (args) => {
  const result = spawnSync(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    { env: dockerEnv, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error("DOCKER_COMMAND_FAILED");
  return result.stdout.trim();
};
const name = "gurukit-drill-" + randomBytes(5).toString("hex"),
  password = randomBytes(24).toString("hex");
dockerEnv.POSTGRES_PASSWORD = password;
let started = false,
  client = null,
  phase = "prepare";
const canonical = (value) =>
  Array.isArray(value)
    ? value
        .map(canonical)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, v]) => [
              key,
              /^(created_at|updated_at)$/.test(key) &&
              typeof v === "string" &&
              !Number.isNaN(Date.parse(v))
                ? new Date(v).toISOString()
                : canonical(v),
            ]),
        )
      : value;
const assert = (condition, label) => {
  if (!condition) throw new Error(label);
};
const fixtureUser = "10000000-0000-4000-8000-000000000001";
let snapshot;
if (process.argv[2])
  snapshot = decryptSnapshot(
    await readFile(process.argv[2]),
    process.env.BACKUP_ENCRYPTION_KEY,
  );
else {
  const now = new Date().toISOString();
  snapshot = {
    version: 1,
    kind: "gurukit-application",
    createdAt: now,
    tables: {
      profiles: [
        {
          id: fixtureUser,
          full_name: "Guru Ujian",
          plan: "free",
          daily_quota: 25,
          created_at: now,
          teaching_context: {},
        },
      ],
      quota_usage: [],
      saved_documents: [
        {
          id: 42,
          user_id: fixtureUser,
          tool_id: "rph-kssm",
          title: "Dokumen pemulihan",
          content: "Kandungan ujian sahaja.",
          created_at: now,
        },
      ],
      rph_templates: [],
      question_banks: [],
    },
  };
  const key = randomBytes(32).toString("hex");
  snapshot = decryptSnapshot(encryptSnapshot(snapshot, key), key);
}
try {
  phase = "container";
  docker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "--memory=1g",
    "--tmpfs",
    "/var/lib/postgresql/data:rw",
    "-e",
    "POSTGRES_PASSWORD",
    "-p",
    "127.0.0.1::5432",
    "postgres@sha256:5264710be20f409750ac6dc4e5706dcef929c87e241605463f0f9aefa932a8d9",
  ]);
  started = true;
  const port = Number(docker(["port", name, "5432/tcp"]).match(/:(\d+)$/)[1]);
  const newClient = () =>
    new Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      connectionTimeoutMillis: 2000,
    });
  for (let n = 0; n < 40; n++) {
    const candidate = newClient();
    try {
      await candidate.connect();
      client = candidate;
      break;
    } catch {
      await candidate.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!client) throw new Error("DATABASE_NOT_READY");
  phase = "schema";
  await client.query(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;`,
  );
  await client.query(
    await readFile(
      new URL("../../supabase/schema.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const file of [
    "20261112_mrsm_security.sql",
    "20261112060000_teaching_pack.sql",
    "20261112090000_production_controls.sql",
  ])
    await client.query(
      await readFile(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  phase = "restore";
  await client.query("begin");
  for (const profile of snapshot.tables.profiles)
    await client.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [profile.id, {}],
    );
  for (const table of BACKUP_TABLES) {
    const rows = snapshot.tables[table];
    if (table === "profiles")
      await client.query(
        `insert into public.profiles select * from jsonb_populate_recordset(null::public.profiles,$1::jsonb) on conflict(id) do update set full_name=excluded.full_name,plan=excluded.plan,daily_quota=excluded.daily_quota,created_at=excluded.created_at,teaching_context=excluded.teaching_context`,
        [JSON.stringify(rows)],
      );
    else
      await client.query(
        `insert into public.${table} ${table === "saved_documents" ? "overriding system value" : ""} select * from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,
        [JSON.stringify(rows)],
      );
  }
  await client.query(
    `select setval(pg_get_serial_sequence('public.saved_documents','id'),greatest(coalesce((select max(id) from public.saved_documents),0),1),exists(select 1 from public.saved_documents))`,
  );
  await client.query("commit");
  for (const table of BACKUP_TABLES) {
    const result = await client.query(
      `select to_jsonb(t) as row from public.${table} t`,
    );
    assert(
      JSON.stringify(canonical(result.rows.map((x) => x.row))) ===
        JSON.stringify(canonical(snapshot.tables[table])),
      "RESTORE_CONTENT_MISMATCH",
    );
  }
  const sql = (query, params = []) => client.query(query, params);
  const actors = Array.from({ length: 12 }, () => randomUUID());
  for (const id of actors)
    await sql("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [
      id,
      {},
    ]);
  await sql(
    "update public.profiles set daily_quota=25 where id=any($1::uuid[])",
    [actors],
  );
  const parallel = async (calls) =>
    Promise.all(
      calls.map(async ({ query, params }) => {
        const c = newClient();
        try {
          await c.connect();
          await c.query("set role service_role");
          const result = await c.query(query, params);
          return { ok: true, result };
        } catch (error) {
          return { ok: false, code: error.code };
        } finally {
          await c.end().catch(() => {});
        }
      }),
    );
  phase = "user_concurrency";
  const userRequests = Array.from({ length: 8 }, () => randomUUID());
  let result = await parallel(
    userRequests.map((id) => ({
      query: "select public.reserve_generation($1,$2)",
      params: [id, actors[0]],
    })),
  );
  assert(
    result.filter((x) => x.ok).length === 1 &&
      result.filter((x) => x.code === "GURUC").length === 7,
    "USER_CONCURRENCY_FAILED",
  );
  await sql(
    `select public.finish_generation(id,false) from public.generation_requests where user_id=$1`,
    [actors[0]],
  );
  phase = "global_concurrency";
  await sql("update public.production_limits set global_concurrent=3");
  const requests = actors
    .slice(1, 11)
    .map((actor) => ({ id: randomUUID(), actor }));
  result = await parallel(
    requests.map((r) => ({
      query: "select public.reserve_generation($1,$2)",
      params: [r.id, r.actor],
    })),
  );
  assert(
    result.filter((x) => x.ok).length === 3 &&
      result.filter((x) => x.code === "GURUC").length === 7,
    "GLOBAL_CONCURRENCY_FAILED",
  );
  await sql(
    `select public.finish_generation(id,false) from public.generation_requests where state='reserved'`,
  );
  phase = "rate";
  result = await parallel(
    Array.from({ length: 20 }, () => ({
      query: "select public.check_generation_rate($1)",
      params: [actors[11]],
    })),
  );
  assert(
    result.filter((x) => x.ok).length === 6 &&
      result.filter((x) => x.code === "GURUR").length === 14,
    "RATE_LIMIT_FAILED",
  );
  phase = "budget";
  await sql(
    "update public.production_limits set global_concurrent=10,global_daily_attempts=3",
  );
  const reservations = actors
    .slice(1, 4)
    .map((actor) => ({ id: randomUUID(), actor }));
  for (const r of reservations)
    await sql("select public.reserve_generation($1,$2)", [r.id, r.actor]);
  const models = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
  ];
  result = await parallel(
    reservations.flatMap((r) =>
      models.map((model) => ({
        query: "select public.begin_model_attempt($1,$2)",
        params: [r.id, model],
      })),
    ),
  );
  assert(
    result.filter((x) => x.ok).length === 3 &&
      result.filter((x) => x.code === "GURUB").length === 6,
    "GLOBAL_BUDGET_FAILED",
  );
  const budget = await sql("select attempts from public.daily_model_budget");
  assert(budget.rows[0].attempts === 3, "BUDGET_COUNTER_FAILED");
  phase = "maintenance";
  await sql("update public.production_limits set generation_enabled=false");
  result = await parallel([
    {
      query: "select public.reserve_generation($1,$2)",
      params: [randomUUID(), actors[11]],
    },
  ]);
  assert(result[0].code === "GURUM", "MAINTENANCE_FAILED");
  phase = "RLS";
  await sql("set role authenticated");
  await sql(`select set_config('request.jwt.claims',$1,false)`, [
    JSON.stringify({ sub: actors[11], role: "authenticated" }),
  ]);
  for (const table of [
    "operational_events",
    "production_limits",
    "operations_runs",
    "daily_model_budget",
  ]) {
    try {
      await sql("select * from public." + table);
      throw new Error("OPERATIONS_EXPOSED");
    } catch (error) {
      assert(error.code === "42501", "OPERATIONS_RLS_FAILED");
    }
  }
  await sql("reset role");
  console.log(
    JSON.stringify({
      status: "passed",
      restore: "isolated Docker PostgreSQL; exact rows verified",
      tables: BACKUP_TABLES,
      scope: "application-data, not Supabase Auth credentials",
      load: {
        perUser: { parallel: 8, accepted: 1, rejected: 7 },
        global: { parallel: 10, accepted: 3, rejected: 7 },
        rate: { parallel: 20, accepted: 6, rejected: 14 },
        dailyBudget: { parallel: 9, accepted: 3, rejected: 6 },
      },
      maintenance: "blocked",
      operationalTables: "not readable by authenticated role",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "failed",
      phase,
      code: error.code || error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
  if (started) docker(["rm", "-f", name]);
}
