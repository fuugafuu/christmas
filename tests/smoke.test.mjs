import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("index.html");
const css=read("styles.css");
const js=read("app.js");
const sql=read("supabase/schema.sql");
const api=read("supabase/functions/christmas-api/index.ts");
const vercel=JSON.parse(read("vercel.json"));

test("public site has accessible, no-login submission",()=>{
  for(const marker of ['id="wishForm"','id="wishName"','id="wishMessage"','id="submitWish"','id="wishGrid"'])
    assert.ok(html.includes(marker),marker);
  assert.ok(!html.includes("ログインしてください"));
  assert.ok(html.includes('maxlength="280"'));
  assert.ok(html.includes('maxlength="24"'));
  assert.ok(html.includes('name="website"'),"anti-spam honeypot");
});
test("interactions and visual preview are wired",()=>{
  for(const marker of ["function formPreview()","function submitForm(","function addLight(","function openReport(",
    "function tickClock()","function renderTreeOrnaments()","function loadWishes(","function shareCard("])
    assert.ok(js.includes(marker),marker);
  assert.ok(js.includes("createText(")&&js.includes(".textContent"));
  assert.ok(!js.includes("innerHTML"),"untrusted messages never go through HTML parsing");
  assert.ok(css.includes("@media(max-width:690px)"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});
test("server API is anonymous but only privileged database code may mutate",()=>{
  assert.ok(api.includes('Deno.serve('));
  assert.ok(api.includes('async function fingerprint('));
  assert.ok(api.includes('db.rpc("christmas_post_wish"'));
  assert.ok(api.includes('db.rpc("christmas_light_wish"'));
  assert.ok(api.includes('action==="report"'));
  assert.ok(api.includes('action==="moderate"'));
  for(const rule of [
    "alter table public.christmas_wishes enable row level security",
    "alter table public.christmas_lights enable row level security",
    "alter table public.christmas_reports enable row level security",
    "revoke all on public.christmas_wishes from public, anon, authenticated",
    "revoke execute on function public.christmas_post_wish"
  ])assert.ok(sql.includes(rule),rule);
  assert.ok(sql.includes("posting_cooldown")&&sql.includes("daily_limit"));
});
test("hosting CSP allows only site and intended DB API",()=>{
  const csp=vercel.headers[0].headers.find(h=>h.key==="Content-Security-Policy")?.value||"";
  assert.ok(csp.includes("ctteohttbcohzlouaxpo.supabase.co"));
  assert.ok(csp.includes("script-src 'self'"));
  assert.ok(!csp.includes("'unsafe-eval'"));
});
