import { createHash } from "node:crypto";
import { decryptSnapshot, snapshotDigest } from "./backup.js";
const API = "https://www.googleapis.com/drive/v3";
const TAG = "gurukit-encrypted-v1";
const FILE = /^gurukit-(daily|weekly)-(\d{4}-\d{2}-\d{2})\.enc$/;
export function driveConfigured(env = process.env) {
  return Boolean(
    env.GOOGLE_DRIVE_CLIENT_ID &&
    env.GOOGLE_DRIVE_CLIENT_SECRET &&
    env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}
export function driveRetention(files) {
  const expired = [];
  for (const kind of ["daily", "weekly"]) {
    const items = files
      .filter(
        (x) =>
          FILE.test(x.name) &&
          x.name.startsWith(`gurukit-${kind}-`) &&
          x.appProperties?.gurukitBackup === TAG &&
          x.appProperties?.kind === kind,
      )
      .sort((a, b) => b.name.localeCompare(a.name));
    const dates = [...new Set(items.map((x) => x.name))];
    const keep = new Set(dates.slice(0, kind === "daily" ? 7 : 4));
    expired.push(...items.filter((x) => !keep.has(x.name)));
  }
  return expired;
}
export async function mirrorDriveBackup(
  encrypted,
  day,
  env = process.env,
  fetchImpl = fetch,
) {
  const present = [
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REFRESH_TOKEN",
  ].filter((k) => env[k]);
  if (!present.length) return { status: "not_configured" };
  if (!driveConfigured(env)) throw new Error("DRIVE_CONFIG_INCOMPLETE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)))
    throw new Error("DRIVE_INVALID_DATE");
  // Authenticate/decrypt locally before sending anything to Google.
  const deadline = AbortSignal.timeout(35000);
  const signal = (ms) => AbortSignal.any([deadline, AbortSignal.timeout(ms)]);
  const original = decryptSnapshot(encrypted, env.BACKUP_ENCRYPTION_KEY);
  const digest = snapshotDigest(original);
  const md5 = createHash("md5").update(encrypted).digest("hex");
  const tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: signal(8000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) throw new Error("DRIVE_AUTH_FAILED");
  const token = await tokenResponse.json();
  if (!token.access_token) throw new Error("DRIVE_AUTH_FAILED");
  async function request(path, options = {}) {
    const response = await fetchImpl(API + path, {
      ...options,
      redirect: "error",
      signal: signal(8000),
      headers: {
        Authorization: "Bearer " + token.access_token,
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error("DRIVE_REQUEST_FAILED");
    return response;
  }
  async function list(q) {
    const files = [];
    let pageToken;
    do {
      const query = new URLSearchParams({
        q,
        spaces: "drive",
        fields:
          "nextPageToken,files(id,name,mimeType,appProperties,md5Checksum,size)",
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await request("/files?" + query);
      const data = await response.json();
      files.push(...(data.files || []));
      pageToken = data.nextPageToken;
      if (files.length > 500 || (pageToken && !data.files?.length))
        throw new Error("DRIVE_LIST_LIMIT");
    } while (pageToken);
    return files;
  }
  const folders = await list(
    "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='gurukitBackup' and value='" +
      TAG +
      "' }",
  );
  if (folders.length > 1) throw new Error("DRIVE_DUPLICATE_FOLDER");
  let folder = folders[0];
  if (!folder) {
    const r = await request("/files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "GuruKit Backups",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { gurukitBackup: TAG },
      }),
    });
    folder = await r.json();
  }
  if (!/^[A-Za-z0-9_-]+$/.test(folder.id || ""))
    throw new Error("DRIVE_FOLDER_INVALID");
  const files = await list(
    `trashed = false and '${folder.id}' in parents and appProperties has { key='gurukitBackup' and value='${TAG}' }`,
  );
  const kinds = ["daily"];
  // Weekly snapshots are made each Sunday in the Malaysia calendar.
  if (new Date(day + "T00:00:00Z").getUTCDay() === 0) kinds.push("weekly");
  for (const kind of kinds) {
    const name = `gurukit-${kind}-${day}.enc`,
      matches = files.filter(
        (x) => x.name === name && x.appProperties?.kind === kind,
      );
    if (matches.length > 1) throw new Error("DRIVE_DUPLICATE_BACKUP");
    let item = matches[0];
    if (
      item &&
      (item.md5Checksum !== md5 || Number(item.size) !== encrypted.length)
    )
      throw new Error("DRIVE_BACKUP_CONFLICT");
    if (!item) {
      const metadata = {
        name,
        parents: [folder.id],
        mimeType: "application/octet-stream",
        appProperties: {
          gurukitBackup: TAG,
          kind,
          scope: "application-data-only",
        },
      };
      const session = await fetchImpl(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,md5Checksum,size,appProperties",
        {
          method: "POST",
          redirect: "error",
          signal: signal(8000),
          headers: {
            Authorization: "Bearer " + token.access_token,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": "application/octet-stream",
            "X-Upload-Content-Length": String(encrypted.length),
          },
          body: JSON.stringify(metadata),
        },
      );
      if (!session.ok) throw new Error("DRIVE_UPLOAD_FAILED");
      const location = new URL(
        session.headers.get("location") || "https://invalid.invalid",
      );
      if (
        location.origin !== "https://www.googleapis.com" ||
        location.pathname !== "/upload/drive/v3/files" ||
        location.username ||
        location.password
      )
        throw new Error("DRIVE_UPLOAD_LOCATION_INVALID");
      const response = await fetchImpl(location.href, {
        method: "PUT",
        redirect: "error",
        signal: signal(10000),
        headers: {
          Authorization: "Bearer " + token.access_token,
          "Content-Type": "application/octet-stream",
        },
        body: encrypted,
      });
      if (!response.ok) throw new Error("DRIVE_UPLOAD_FAILED");
      item = await response.json();
      files.push(item);
      if (item.md5Checksum !== md5 || Number(item.size) !== encrypted.length)
        throw new Error("DRIVE_CHECKSUM_FAILED");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(item.id || ""))
      throw new Error("DRIVE_FILE_INVALID");
    const downloaded = await request("/files/" + item.id + "?alt=media");
    if (Number(downloaded.headers.get("content-length")) > 12 * 1024 * 1024)
      throw new Error("DRIVE_BACKUP_TOO_LARGE");
    // Limit the streamed read even if Content-Length is missing or incorrect.
    const chunks = [];
    let bytes = 0;
    for await (const chunk of downloaded.body) {
      bytes += chunk.length;
      if (bytes > 12 * 1024 * 1024) throw new Error("DRIVE_BACKUP_TOO_LARGE");
      chunks.push(chunk);
    }
    const restored = decryptSnapshot(
      Buffer.concat(chunks),
      env.BACKUP_ENCRYPTION_KEY,
    );
    if (snapshotDigest(restored) !== digest)
      throw new Error("DRIVE_VERIFY_FAILED");
  }
  // Only our tagged, dated archives in our app-created folder are eligible.
  let retainedCleanup = true;
  for (const item of driveRetention(files)) {
    if (deadline.aborted) {
      retainedCleanup = false;
      break;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(item.id || ""))
      throw new Error("DRIVE_FILE_INVALID");
    try {
      await request("/files/" + item.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
    } catch {
      retainedCleanup = false;
    }
  }
  return {
    status: "verified",
    scope: "application-data-only",
    copies: kinds.length,
    retentionCleanup: retainedCleanup,
  };
}
