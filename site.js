
(() => {
"use strict";
const API="https://ctteohttbcohzlouaxpo.supabase.co/functions/v1/christmas-api";
const STORE="snowletter-owned-v2", LIGHTS="snowletter-lights", PREFS="snowletter-prefs";
const ORN={star:"✦",bell:"🔔",gift:"🎁",snowflake:"❄",heart:"♡",candy:"🍬"};
const STYLES=new Set(["cranberry","fir","snow","midnight"]);
const $=(q,base=document)=>base.querySelector(q);
const state={busy:false,feed:[],page:0,sort:"new",style:"all",search:"",more:false,lastQuery:0,target:null};
function E(tag,cls,t){const e=document.createElement(tag);if(cls)e.className=cls;if(t!==undefined)e.textContent=t;return e}
function toast(s,type="ok"){const e=$("#toast");e.textContent=s;e.dataset.type=type;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove("show"),4000)}
function readOwned(){
 try{const a=JSON.parse(localStorage.getItem(STORE)||"[]");return Array.isArray(a)?a.filter(x=>x&&/^[a-f\d-]{36}$/i.test(x.id)&&typeof x.ownerToken==="string").slice(-100):[]}
 catch{return []}
}
function saveOwned(w,ownerToken){const all=readOwned().filter(x=>x.id!==w.id);all.push({id:w.id,ownerToken,createdAt:w.createdAt});localStorage.setItem(STORE,JSON.stringify(all.slice(-100)))}
function removeOwned(id){localStorage.setItem(STORE,JSON.stringify(readOwned().filter(x=>x.id!==id)))}
function ownToken(id){return readOwned().find(x=>x.id===id)?.ownerToken}
function makeToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
async function request(action,opts={}){
 const url=new URL(API);url.searchParams.set("action",action);
 for(const [key,val] of Object.entries(opts.params||{}))url.searchParams.set(key,String(val));
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),18000);
 try{
   const response=await fetch(url,{method:opts.body?"POST":"GET",mode:"cors",cache:"no-store",
     headers:opts.body?{"Content-Type":"application/json"}:undefined,
     body:opts.body?JSON.stringify(opts.body):undefined,signal:ctl.signal});
   const json=await response.json().catch(()=>({}));
   if(!response.ok||json.ok!==true)throw Error(json.error||"通信に失敗しました。");
   return json;
 }catch(error){throw Error(error.name==="AbortError"?"通信に時間がかかっています。時間をおいて試してください。":error.message)}
 finally{clearTimeout(timeout)}
}
const fmt=new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"numeric",day:"numeric",timeZone:"Asia/Tokyo"});
function card(w,mode="public"){
 const item=E("article","card-item");item.id="wish-"+w.id;
 const body=E("div","wish-card theme-"+(STYLES.has(w.style)?w.style:"cranberry"));
 body.append(E("span","card-heading","Merry Christmas"));
 const deco=E("span","ornament ornament-"+(ORN[w.ornament]?w.ornament:"star"));
 deco.setAttribute("role","img");deco.setAttribute("aria-label",w.ornament||"星");
 body.append(deco,E("p","card-message",w.message));
 const sign=E("div","card-name");
 sign.append(E("span",null,"from "),E("strong",null,w.name));
 body.append(sign);item.append(body);
 const foot=E("div","card-foot");
 const date=E("time","date",fmt.format(new Date(w.createdAt)));date.dateTime=w.createdAt;foot.append(date);
 const actions=E("div","card-actions");
 if(mode==="mine"){
   const edit=E("button","text-button","編集");edit.type="button";edit.onclick=()=>openEdit(w);
   const code=E("button","text-button","管理コード");code.type="button";code.onclick=()=>copyCode(w);
   const del=E("button","text-button danger","取り消す");del.type="button";del.onclick=()=>cancel(w);
   actions.append(edit,code,del);
 }else{
   const lit=alreadyLit(w.id);
   const light=E("button","light-button"+(lit?" lit":""),(lit?"★":"☆")+" "+String(w.lights||0));
   light.type="button";light.title="光を贈る";light.onclick=()=>giveLight(w,light);
   const share=E("button","text-button","共有");share.type="button";share.onclick=()=>shareWish(w);
   actions.append(light,share);
   if(mode==="public"){
     const report=E("button","text-button","報告");report.type="button";report.onclick=()=>{$("#reportDialog").showModal();state.target=w};
     actions.append(report);
   }
 }
 foot.append(actions);item.append(foot);return item;
}
function empty(parent,title,desc){
 const wrap=E("div","empty");
 wrap.append(E("span","empty-star","❄"),E("h2",null,title),E("p",null,desc));
 parent.replaceChildren(wrap);
}
function alreadyLit(id){try{return JSON.parse(localStorage.getItem(LIGHTS)||"[]").includes(id)}catch{return false}}
async function giveLight(w,button){
 if(alreadyLit(w.id))return toast("この投稿にはもう光を贈っています。");
 button.disabled=true;
 try{
  const data=await request("light",{body:{id:w.id}});
  w.lights=data.lights;
  try{const saved=JSON.parse(localStorage.getItem(LIGHTS)||"[]");saved.push(w.id);localStorage.setItem(LIGHTS,JSON.stringify(saved.slice(-500)))}catch{}
  button.textContent="★ "+String(w.lights||0);button.classList.add("lit");toast(data.added?"光を贈りました。":"すでに光を贈っています。");
 }catch(e){toast(e.message,"error")}
 finally{button.disabled=false}
}
async function shareWish(w){
 const link=new URL("/messages.html",location.origin);link.hash="wish-"+w.id;
 try{if(navigator.share)await navigator.share({title:"クリスマスのメッセージ",url:String(link)});
 else {await navigator.clipboard.writeText(String(link));toast("リンクをコピーしました。")}}
 catch(e){if(e.name!=="AbortError")toast("リンクをコピーできませんでした。","error")}
}
function installReport(){
 const d=$("#reportDialog");if(!d)return;
 $("#closeReport").onclick=()=>d.close();
 $("#submitReport").onclick=async()=>{
  if(!state.target)return;const b=$("#submitReport");b.disabled=true;
  try{await request("report",{body:{id:state.target.id,reason:$("#reportReason").value}});d.close();toast("報告を受け付けました。")}
  catch(e){toast(e.message,"error")}finally{b.disabled=false}
 };
}
function field(form,name){return form.querySelector('[name="'+name+'"]')}
function getWish(form){
 return {name:field(form,"name").value.trim(),message:field(form,"message").value.trim(),
  style:form.querySelector('[name="style"]:checked')?.value||"cranberry",
  ornament:form.querySelector('[name="ornament"]:checked')?.value||"star",
  website:field(form,"website")?.value||""};
}
function validWish(v){
 if(v.name.length<1||v.name.length>24)return "名前は1〜24文字で入力してください。";
 if(v.message.length<2||v.message.length>280)return "メッセージは2〜280文字で入力してください。";
 if(v.website)return "投稿できませんでした。";
 return "";
}
function preview(){
 const form=$("#wishForm"),v=getWish(form);
 $("#livePreview").className="wish-card theme-"+v.style;
 $("#previewMessage").textContent=v.message||"ここにメッセージが表示されます。";
 $("#previewName").textContent=v.name||"あなた";
 $("#previewOrn").className="ornament ornament-"+v.ornament;
 $("#charCount").textContent=String(field(form,"message").value.length);
}
function installWrite(){
 const form=$("#wishForm");if(!form)return;
 try{field(form,"name").value=localStorage.getItem("snowletter-name")||""}catch{}
 form.addEventListener("input",preview);form.addEventListener("change",preview);preview();
 form.onsubmit=async e=>{
  e.preventDefault();if(state.busy)return;
  const v=getWish(form),message=validWish(v);if(message)return toast(message,"error");
  state.busy=true;const b=$("#submitWish");b.disabled=true;b.textContent="投稿中…";
  const ownerToken=makeToken();
  try{
   const data=await request("post",{body:{...v,ownerToken}});
   try{saveOwned(data.wish,ownerToken);localStorage.setItem("snowletter-name",v.name)}
   catch{toast("投稿できましたが、端末に管理情報を保存できませんでした。","error")}
   location.assign("/mine.html?posted=1");
  }catch(error){toast(error.message,"error")}
  finally{state.busy=false;b.disabled=false;b.textContent="投稿する ↗"}
 };
}
async function loadHome(){
 const target=$("#homeFeed");
 try{const data=await request("messages",{params:{page:0,limit:6}});
 const items=data.items.slice(0,3);
 if(items.length)target.replaceChildren(...items.map(x=>card(x,"home")));
 else empty(target,"まだ投稿はありません。","最初のメッセージを投稿してみませんか。")}
 catch(error){empty(target,"読み込めませんでした。",error.message)}
}
async function loadFeed(reset=true){
 const feed=$("#wishGrid"),serial=++state.lastQuery;
 if(reset){state.page=0;state.feed=[];feed.replaceChildren(E("p","loading","読み込み中…"))}
 const more=$("#loadMore");more.disabled=true;
 try{
  const res=await request("messages",{params:{page:state.page,limit:12,sort:state.sort,style:state.style,q:state.search}});
  if(serial!==state.lastQuery)return;
  state.feed=reset?res.items:state.feed.concat(res.items);state.page++;state.more=res.hasMore;
  if(state.feed.length)feed.replaceChildren(...state.feed.map(x=>card(x)));
  else empty(feed,"見つかりませんでした。","検索条件を変えてみてください。");
  more.hidden=!state.more;$("#feedStatus").textContent="全 "+res.total+" 件";
  const match=location.hash.match(/^#wish-([a-f\d-]{36})$/i);
  if(match)document.getElementById("wish-"+match[1])?.scrollIntoView({block:"center"});
 }catch(e){if(serial===state.lastQuery){empty(feed,"読み込めませんでした。",e.message);$("#feedStatus").textContent="接続エラー"}}
 finally{more.disabled=false}
}
function installFeed(){
 if(!$("#wishGrid"))return;
 let delay;$("#wishSearch").oninput=e=>{clearTimeout(delay);delay=setTimeout(()=>{state.search=e.target.value.trim();loadFeed()},300)};
 $("#sort").onchange=e=>{state.sort=e.target.value;loadFeed()};
 $("#style").onchange=e=>{state.style=e.target.value;loadFeed()};
 $("#refreshWishes").onclick=()=>loadFeed();
 $("#loadMore").onclick=()=>loadFeed(false);
 loadFeed();
}
async function loadMine(){
 const feed=$("#mineGrid"),records=readOwned();
 if(!records.length)return empty(feed,"まだ投稿はありません。","このブラウザから投稿すると、ここに表示されます。");
 feed.replaceChildren(E("p","loading","読み込み中…"));
 try{
  const data=await request("mine",{body:{posts:records}});
  data.items.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  if(data.items.length)feed.replaceChildren(...data.items.map(x=>card(x,"mine")));
  else empty(feed,"表示できる投稿がありません。","削除した投稿は表示されません。");
 }catch(e){empty(feed,"読み込めませんでした。",e.message)}
}
function openEdit(w){
 state.target=w;
 const dialog=$("#editDialog");
 $("#editName").value=w.name;$("#editMessage").value=w.message;
 $("#editStyle").value=w.style;$("#editOrn").value=w.ornament;
 dialog.showModal();
}
async function cancel(w){
 if(!confirm("この投稿を取り消しますか？\n取り消すと元には戻せません。"))return;
 if(state.busy)return;state.busy=true;
 try{
  await request("delete",{body:{id:w.id,ownerToken:readOwned().find(x=>x.id===w.id)?.ownerToken}});
  removeOwned(w.id);toast("投稿を取り消しました。");await loadMine();
 }catch(e){toast(e.message,"error")}
 finally{state.busy=false}
}

async function copyCode(w){
 const ownerToken=readOwned().find(x=>x.id===w.id)?.ownerToken;
 if(!ownerToken)return toast("管理コードが見つかりません。","error");
 const value="SL2|"+w.id+"|"+ownerToken;
 try{
  await navigator.clipboard.writeText(value);
  toast("管理コードをコピーしました。人には見せないでください。");
 }catch{
  window.prompt("この管理コードを安全な場所に控えてください。",value);
 }
}
async function restoreOwn(){
 const field=$("#recoveryCode"),code=field.value.trim();
 const parts=code.split("|");
 if(parts.length!==3||parts[0]!=="SL2"||!/^[a-f\d-]{36}$/i.test(parts[1])||!/^[A-Za-z0-9_-]{43,64}$/.test(parts[2]))
   return toast("管理コードの形式を確認してください。","error");
 const b=$("#restorePost");b.disabled=true;
 try{
  const result=await request("mine",{body:{posts:[{id:parts[1],ownerToken:parts[2]}]}});
  if(!result.items.length)throw Error("このコードで管理できる投稿が見つかりません。");
  saveOwned(result.items[0],parts[2]);field.value="";
  toast("投稿を読み込みました。");await loadMine();
 }catch(e){toast(e.message,"error")}finally{b.disabled=false}
}

function installMine(){
 if(!$("#mineGrid"))return;
 const dialog=$("#editDialog");$("#closeEdit").onclick=()=>dialog.close();
 $("#restorePost").onclick=restoreOwn;
 $("#editForm").onsubmit=async e=>{
  e.preventDefault();if(state.busy||!state.target)return;
  const v={name:$("#editName").value.trim(),message:$("#editMessage").value.trim(),
  style:$("#editStyle").value,ornament:$("#editOrn").value};
  const message=validWish(v);if(message)return toast(message,"error");
  state.busy=true;const b=$("#saveEdit");b.disabled=true;
  try{
   await request("edit",{body:{...v,id:state.target.id,ownerToken:readOwned().find(x=>x.id===state.target.id)?.ownerToken}});
   dialog.close();toast("投稿を更新しました。");await loadMine();
  }catch(err){toast(err.message,"error")}
  finally{state.busy=false;b.disabled=false}
 };
 if(new URLSearchParams(location.search).has("posted"))setTimeout(()=>toast("投稿しました。ここから編集・取り消しができます。"),500);
 loadMine();
}
const smallIdeas=[
"好きなクリスマスソングを聴く。","温かい飲み物でひと休み。","小さな飾りをひとつ置く。","今年の写真を見返す。",
"誰かに「ありがとう」を送る。","夜のイルミネーションを見る。","おいしいお菓子を選ぶ。","暖かい靴下でのんびり。",
"クリスマス映画を一本。","飾りつけを少し進める。","冬の空を眺める。","送る言葉を考える。",
"温かいスープを作る。","サンタの飾りを探してみる。","昔のクリスマスを思い出す。","ケーキを選ぶ。",
"プレゼントを考える。","友達にメッセージを送る。","部屋の灯りを少し変える。","クリスマスの予定を立てる。",
"好きな歌を口ずさむ。","今年のよかったことを数える。","明日の準備をちょっとだけ。","よいクリスマスを！"
];
function tokyoParts(){
 const d=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date());
 const get=k=>Number(d.find(p=>p.type===k)?.value||0);
 return {year:get("year"),month:get("month"),day:get("day")};
}
function tick(){
 const {year,month,day}=tokyoParts();
 const christmas=month===12&&day===25;
 const y=month===12&&day>25?year+1:year;
 let t=christmas?0:Math.max(0,Date.parse(y+"-12-25T00:00:00+09:00")-Date.now());
 const parts=[Math.floor(t/86400000),Math.floor(t%86400000/3600000),Math.floor(t%3600000/60000),Math.floor(t%60000/1000)];
 ["days","hours","minutes","seconds"].forEach((id,i)=>$("#"+id).textContent=String(parts[i]).padStart(2,"0"));
 $("#countdownStatus").textContent=christmas?"メリークリスマス！":y+"年12月25日まで";
}
function advent(){
 const grid=$("#adventGrid"),{month,day}=tokyoParts();
 const ready=month===12?Math.min(24,day):0;
 for(let n=1;n<=24;n++){
  const b=E("button","advent-day"+(n<=ready?" available":" locked"),String(n));
  b.disabled=n>ready;b.title=n<=ready?n+"日を見る":n+"日になったら開けられます";
  b.onclick=()=>{$("#adventMessage").textContent=n+"日： "+smallIdeas[n-1];b.classList.add("opened")};
  grid.append(b);
 }
}
function prefs(){try{return JSON.parse(localStorage.getItem(PREFS)||"{}")}catch{return {}}}
function initSnow(){
 const container=$("#snow");if(!container)return;
 container.replaceChildren();
 const enabled=prefs().snow!==false;container.hidden=!enabled;
 if(!enabled||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
 const count=innerWidth<600?18:34;
 for(let i=0;i<count;i++){
  const flake=E("span","flake");
  flake.style.left=((i*59.73)%100)+"%";
  flake.style.width=flake.style.height=(2+i%3)+"px";
  flake.style.animationDuration=(11+i%7*2)+"s";
  flake.style.animationDelay=(-i*1.8)+"s";
  container.append(flake);
 }
}
function installCountdown(){
 if(!$("#days"))return;
 tick();advent();setInterval(()=>{if(!document.hidden)tick()},1000);
 $("#snowToggle").checked=prefs().snow!==false;
 $("#snowToggle").onchange=e=>{try{localStorage.setItem(PREFS,JSON.stringify({...prefs(),snow:e.target.checked}))}catch{}initSnow()};
}
function boot(){
 $("#menuToggle").onclick=()=>{const nav=$("#nav"),on=nav.classList.toggle("expanded");$("#menuToggle").setAttribute("aria-expanded",String(on))};
 initSnow();installReport();installWrite();installFeed();installMine();installCountdown();
 if($("#homeFeed"))loadHome();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();
