// Never prints API keys. Run after placing RESEND_API_KEY in secure environment settings.
const domain = "ghazwahgroup.com",
  sender = "noreply@ghazwahgroup.com";
const team = process.env.VERCEL_TEAM_ID,
  projectRef = process.env.SUPABASE_PROJECT_REF;
if (
  !process.env.RESEND_API_KEY ||
  !process.env.VERCEL_TOKEN ||
  !process.env.VERCEL_PROJECT_ID ||
  !process.env.SUPABASE_ACCESS_TOKEN ||
  !team ||
  !projectRef
)
  throw new Error(
    "RESEND_API_KEY and existing infrastructure bindings are required.",
  );
async function request(url, token, method = "GET", data) {
  const r = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok) throw new Error(`Setup request failed: HTTP ${r.status}`);
  return r.json();
}
const base = "https://api.resend.com";
const domains = await request(base + "/domains", process.env.RESEND_API_KEY);
let item = domains.data?.find((x) => x.name === domain);
if (!item)
  item = await request(base + "/domains", process.env.RESEND_API_KEY, "POST", {
    name: domain,
  });
let details = await request(
  base + "/domains/" + item.id,
  process.env.RESEND_API_KEY,
);
const dnsBase = "https://api.vercel.com",
  query = "?teamId=" + encodeURIComponent(team);
const existing = await request(
  dnsBase + "/v4/domains/" + domain + "/records" + query,
  process.env.VERCEL_TOKEN,
);
for (const record of details.records || []) {
  let name = record.name.replace(
    new RegExp("\\." + domain.replace(/\./g, "\\.") + "$"),
    "",
  );
  if (
    !["send", "resend._domainkey"].includes(name) ||
    !["TXT", "MX"].includes(record.type)
  )
    throw new Error(
      "Unexpected DNS record; review manually. No root MX/A records are changed.",
    );
  if (
    existing.records.some(
      (x) =>
        x.name === name && x.type === record.type && x.value === record.value,
    )
  )
    continue;
  if (existing.records.some((x) => x.name === name && x.type === record.type))
    throw new Error("Conflicting DNS record requires operator review.");
  await request(
    dnsBase + "/v2/domains/" + domain + "/records" + query,
    process.env.VERCEL_TOKEN,
    "POST",
    {
      name,
      type: record.type,
      value: record.value,
      ttl: 60,
      ...(record.type === "MX"
        ? { mxPriority: Number(record.priority) || 10 }
        : {}),
    },
  );
  console.log(`DNS record configured: ${name} ${record.type}`);
}
await request(
  base + "/domains/" + item.id + "/verify",
  process.env.RESEND_API_KEY,
  "POST",
);
details = await request(
  base + "/domains/" + item.id,
  process.env.RESEND_API_KEY,
);
if (details.status !== "verified") {
  console.log(
    "Domain verification pending. Rerun after DNS propagation; Supabase SMTP remains unchanged.",
  );
  process.exit(0);
}
await request(
  "https://api.supabase.com/v1/projects/" + projectRef + "/config/auth",
  process.env.SUPABASE_ACCESS_TOKEN,
  "PATCH",
  {
    smtp_host: "smtp.resend.com",
    smtp_port: 465,
    smtp_user: "resend",
    smtp_pass: process.env.RESEND_API_KEY,
    smtp_admin_email: sender,
    smtp_sender_name: "GuruKit",
    rate_limit_email_sent: 30,
  },
);
await request(
  "https://api.vercel.com/v10/projects/" +
    process.env.VERCEL_PROJECT_ID +
    "/env?teamId=" +
    encodeURIComponent(team) +
    "&upsert=true",
  process.env.VERCEL_TOKEN,
  "POST",
  [
    {
      key: "RESEND_API_KEY",
      value: process.env.RESEND_API_KEY,
      type: "sensitive",
      target: ["production"],
    },
  ],
);
console.log(
  "Verified Resend domain connected to Supabase SMTP. Production alert key saved; redeploy Vercel to activate it. No test email sent.",
);
