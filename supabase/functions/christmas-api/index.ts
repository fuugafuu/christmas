// Christmas Wishes / anonymous public Edge API
// Deployed with verify_jwt=false: every mutation is validated, rate-limited and isolated here.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-christmas-admin-key",
  "Access-Control-Max-Age": "86400"
};
const dbUrl=Deno.env.get("SUPABASE_URL") ?? "";
const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serverKey=secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db=createClient(dbUrl,serverKey,{auth:{autoRefreshToken:false,persistSession:false}});
const STYLES=new Set(["cranberry","fir","snow","midnight"]);
const ORNAMENTS=new Set(["star","bell","gift","snowflake","heart","candy"]);
const REPORT_REASONS=new Set(["spam","inappropriate","personal_info","other"]);
const encode=new TextEncoder();

function respond(body:unknown,status=200) {
  return new Response(JSON.stringify(body),{
    status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
function failure(message:string,status=400) {
  return respond({ok:false,error:message},status);
}
function cleanId(raw:unknown){
  const id=String(raw??"");
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)?id:null;
}
function pickClientIP(req:Request){
  // Supabase gateway sets forwarding headers; never retain a raw IP.
  const header=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")||"";
  return (header.split(",")[0]||"unknown").trim().slice(0,120);
}
async function fingerprint(req:Request){
  // Use a server-only pepper so no IP address is stored directly.
  const data=encode.encode(pickClientIP(req)+"|christmas-2026|"+serverKey.slice(-48));
  const hash=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
function publicWish(row:any){
  return {id:row.id,name:row.display_name,message:row.message,
    style:row.card_style,ornament:row.ornament,lights:row.light_count,
    createdAt:row.created_at};
}
function translateError(error:any){
  const msg=String(error?.message||"");
  if(msg.includes("posting_cooldown"))return ["次の投稿まで約1分あけてください。",429];
  if(msg.includes("daily_limit"))return ["24時間の投稿上限（15件）に達しました。",429];
  if(msg.includes("duplicate_message"))return ["同じメッセージは連続で投稿できません。",409];
  if(msg.includes("links_not_allowed"))return ["安全のためURL・メールアドレスは投稿できません。",422];
  if(msg.includes("name_length"))return ["お名前は1〜24文字で入力してください。",422];
  if(msg.includes("message_length"))return ["メッセージは2〜280文字で入力してください。",422];
  if(msg.includes("invalid_characters"))return ["改行以外の制御文字は使えません。",422];
  if(msg.includes("light_limit"))return ["今日のイルミネーション上限に達しました。",429];
  if(msg.includes("wish_not_found"))return ["メッセージが見つかりません。",404];
  return ["処理に失敗しました。もう一度お試しください。",500];
}
function validText(value:unknown,max:number){
  return typeof value==="string" ? value.trim().slice(0,max+1) : "";
}
function authorized(req:Request){
  const expected=Deno.env.get("CHRISTMAS_ADMIN_TOKEN")||"";
  const given=req.headers.get("x-christmas-admin-key")||"";
  if(expected.length<24||expected.length!==given.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^given.charCodeAt(i);
  return diff===0;
}
async function listMessages(url:URL){
  const page=Math.min(100,Math.max(0,Number.parseInt(url.searchParams.get("page")||"0")||0));
  const limit=Math.min(24,Math.max(6,Number.parseInt(url.searchParams.get("limit")||"12")||12));
  const sort=url.searchParams.get("sort")==="popular"?"popular":"new";
  const style=url.searchParams.get("style")||"all";
  let query=db.from("christmas_wishes")
    .select("id,display_name,message,card_style,ornament,light_count,created_at",{count:"exact"})
    .eq("is_hidden",false);
  if(STYLES.has(style))query=query.eq("card_style",style);
  if(sort==="popular")query=query.order("light_count",{ascending:false}).order("created_at",{ascending:false});
  else query=query.order("created_at",{ascending:false});
  const {data,error,count}=await query.range(page*limit,(page+1)*limit-1);
  if(error){console.error("list",error.message);return failure("読み込みに失敗しました。",503)}
  const total=Number(count||0);
  return respond({ok:true,items:(data||[]).map(publicWish),total,page,limit,hasMore:(page+1)*limit<total});
}
async function readStats(){
  const {data,error}=await db.rpc("christmas_board_stats");
  if(error){console.error("stats",error.message);return failure("集計を取得できませんでした。",503)}
  return respond({ok:true,...(data||{wishes:0,lights:0,today:0})});
}
async function postWish(req:Request,body:any){
  const name=validText(body.name,24),message=validText(body.message,280);
  const style=String(body.style||"cranberry"),ornament=String(body.ornament||"star");
  if(body.website)return failure("投稿を受け付けられませんでした。",400);
  if(name.length<1||name.length>24)return failure("名前は1〜24文字で入力してください。",422);
  if(message.length<2||message.length>280)return failure("メッセージは2〜280文字で入力してください。",422);
  if(!STYLES.has(style)||!ORNAMENTS.has(ornament))return failure("カードのデザインが不正です。",422);
  const ipHash=await fingerprint(req);
  const {data,error}=await db.rpc("christmas_post_wish",{
    p_name:name,p_message:message,p_style:style,p_ornament:ornament,p_ip_hash:ipHash
  });
  if(error){const [m,s]=translateError(error);if(s===500)console.error("post",error.message);return failure(m,s)}
  return respond({ok:true,wish:data},201);
}
async function addLight(req:Request,body:any){
  const id=cleanId(body.id);if(!id)return failure("投稿IDが不正です。",422);
  const {data,error}=await db.rpc("christmas_light_wish",{p_wish_id:id,p_ip_hash:await fingerprint(req)});
  if(error){const [m,s]=translateError(error);if(s===500)console.error("light",error.message);return failure(m,s)}
  return respond({ok:true,...data});
}
async function reportWish(req:Request,body:any){
  const id=cleanId(body.id),reason=String(body.reason||"other");
  if(!id||!REPORT_REASONS.has(reason))return failure("報告内容を確認してください。",422);
  const ipHash=await fingerprint(req);
  const {count,error:countError}=await db.from("christmas_reports").select("wish_id",{count:"exact",head:true})
    .eq("ip_hash",ipHash).gte("created_at",new Date(Date.now()-86400000).toISOString());
  if(countError)return failure("報告の処理に失敗しました。",503);
  if((count||0)>=10)return failure("24時間の報告上限に達しました。",429);
  const {error}=await db.from("christmas_reports").insert({wish_id:id,ip_hash:ipHash,reason});
  if(error&&error.code!=="23505")return failure("報告の処理に失敗しました。",503);
  return respond({ok:true,alreadyReported:error?.code==="23505"});
}
async function adminRead(req:Request){
  if(!authorized(req))return failure("管理者認証が必要です。",403);
  const [{data:posts,error:e1},{data:reports,error:e2}]=await Promise.all([
    db.from("christmas_wishes").select("id,display_name,message,card_style,ornament,is_hidden,light_count,created_at")
      .order("created_at",{ascending:false}).limit(150),
    db.from("christmas_reports").select("wish_id,reason,created_at").order("created_at",{ascending:false}).limit(300)
  ]);
  if(e1||e2)return failure("管理データを取得できませんでした。",503);
  const reportMap:Record<string,number>={};
  for(const row of reports||[])reportMap[row.wish_id]=(reportMap[row.wish_id]||0)+1;
  return respond({ok:true,items:(posts||[]).map((p:any)=>({...publicWish(p),hidden:p.is_hidden,reports:reportMap[p.id]||0}))});
}
async function adminModerate(req:Request,body:any){
  if(!authorized(req))return failure("管理者認証が必要です。",403);
  const id=cleanId(body.id);if(!id||typeof body.hidden!=="boolean")return failure("管理内容が不正です。",422);
  const {error}=await db.from("christmas_wishes").update({is_hidden:body.hidden}).eq("id",id);
  if(error)return failure("管理操作に失敗しました。",503);
  return respond({ok:true});
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(!dbUrl||!serverKey)return failure("保存サービスの設定がありません。",503);
  try{
    const url=new URL(req.url),action=url.searchParams.get("action")||"messages";
    if(req.method==="GET"){
      if(action==="health")return respond({ok:true,service:"christmas-api",version:"1.0.0"});
      if(action==="messages")return await listMessages(url);
      if(action==="stats")return await readStats();
      if(action==="admin")return await adminRead(req);
      return failure("不明な操作です。",404);
    }
    if(req.method!=="POST")return failure("この操作は利用できません。",405);
    const text=await req.text();
    if(text.length>4096)return failure("送信内容が長すぎます。",413);
    let body:any={};
    try{body=JSON.parse(text||"{}")}catch{return failure("送信形式が正しくありません。",400)}
    if(!body||typeof body!=="object"||Array.isArray(body))return failure("入力内容が正しくありません。",400);
    if(action==="post")return await postWish(req,body);
    if(action==="light")return await addLight(req,body);
    if(action==="report")return await reportWish(req,body);
    if(action==="moderate")return await adminModerate(req,body);
    return failure("不明な操作です。",404);
  }catch(error){
    console.error("christmas-edge",error instanceof Error?error.message:error);
    return failure("一時的に利用できません。",503);
  }
});
