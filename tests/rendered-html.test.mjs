import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the escape-room entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /수학초미녀의 비밀 연구실/);
  assert.match(html, /이차함수/);
  assert.match(html, /제한 시간 40:00/);
  assert.match(html, /연구실 입장/);
  assert.match(html, /여자 연구원/);
  assert.match(html, /남자 연구원/);
  assert.doesNotMatch(html, /SUPABASE_SECRET_KEY|sb_secret_/);
});

test("keeps Supabase writes server-side with protected table setup", async () => {
  const [route, schema, envExample] = await Promise.all([
    readFile(new URL("../app/api/results/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(route, /SUPABASE_SECRET_KEY/);
  assert.match(route, /\/rest\/v1\/escape_results/);
  assert.match(route, /resolution=merge-duplicates/);
  assert.match(schema, /run_id text unique/i);
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /revoke all on table public\.escape_results from anon, authenticated/i);
  assert.match(envExample, /sb_secret_REPLACE_ME/);
  assert.doesNotMatch(envExample, /sb_secret_[A-Za-z0-9_-]{20,}/);
});
