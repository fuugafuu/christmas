import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root=(f)=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const api=root("supabase/functions/christmas-api/index.ts"),js=root("site.js"),css=root("site.css");
const pages={home:"index.html",write:"write.html",messages:"messages.html",mine:"mine.html",countdown:"countdown.html"};

test("separate short pages, accessible navigation and scripts",()=>{
 for(const [name,path] of Object.entries(pages)){
  const html=root(path);
  assert.ok(html.includes('data-page="'+name+'"'),path);
  assert.ok(html.includes('src="/site.js?v=2.0.0"'),path);
  assert.ok(html.includes('href="/mine.html"')&&html.includes('href="/countdown.html"'),path);
  assert.ok(html.includes('href="/messages.html"')&&html.includes('href="/write.html"'),path);
 }
 assert.ok(!root("index.html").includes("id=\"wishForm\""),"home should not contain long message form");
 assert.ok(!root("index.html").includes("id=\"adventGrid\""),"home should not contain calendar");
});
test("post management requires unguessable token, and lists own posts",()=>{
 assert.ok(js.includes("crypto.getRandomValues(new Uint8Array(32))"));
 assert.ok(js.includes('"/mine.html?posted=1"'));
 assert.ok(js.includes('request("mine"'));
 assert.ok(js.includes('request("edit"'));
 assert.ok(js.includes('request("delete"'));
 assert.ok(js.includes("confirm("));
 assert.ok(js.includes("localStorage.setItem(STORE"));
 assert.ok(js.includes("async function copyCode("));
 assert.ok(js.includes("async function restoreOwn("));
 assert.ok(root("mine.html").includes('id="recoveryCode"'));
 assert.ok(root("mine.html").includes('id="restorePost"'));
 assert.ok(api.includes('ownerHash('));
 assert.ok(api.includes('christmas_post_wish_owned'));
 assert.ok(api.includes('christmas_edit_own_wish'));
 assert.ok(api.includes('christmas_delete_own_wish'));
 assert.ok(api.includes('action==="mine"'));
});
test("wall includes search/reactions/report and safely inserts user text",()=>{
 assert.ok(js.includes('request("messages"'));
 assert.ok(js.includes('request("light"'));
 assert.ok(js.includes('request("report"'));
 assert.ok(js.includes('.textContent='));
 assert.ok(!js.includes(".innerHTML"));
 assert.ok(root("messages.html").includes("id=\"wishSearch\""));
});
test("countdown is JST and advent calendar is day-gated",()=>{
 assert.ok(js.includes('timeZone:"Asia/Tokyo"'));
 assert.ok(js.includes('T00:00:00+09:00'));
 assert.ok(js.includes('n<=ready'));
 assert.ok(root("countdown.html").includes('id="snowToggle"'));
});
test("all 14 Christmas decorative asset files are locally served",()=>{
 const assets=["icons","ornaments","winter","badges","scenes","buttons","frames","dividers","forest","paper","velvet","gold","snow","knit"];
 for(const name of assets)assert.ok(root("assets/"+name+".svg").startsWith("<svg"),"missing "+name);
 assert.ok(!css.includes(".webp"),"missing binary asset references");
 assert.ok(css.includes(".ornament-star")&&css.includes(".scene-gifts"));
});
test("the existing anonymous database service is isolated",()=>{
 const sql=root("supabase/migrations/20261110120000_christmas_anonymous_ownership.sql");
 assert.ok(sql.includes("owner_token_hash"));
 assert.ok(sql.includes("where id=p_id and owner_token_hash=p_owner_hash"));
 assert.ok(sql.includes("grant execute on function public.christmas_delete_own_wish"));
 assert.ok(!sql.includes("drop table"));
});
