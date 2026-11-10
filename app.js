(()=>{
"use strict";
const API="https://ctteohttbcohzlouaxpo.supabase.co/functions/v1/christmas-api";
const ICONS={star:"✦",bell:"🔔",gift:"🎁",snowflake:"❄",heart:"♡",candy:"🍬"};
const STYLE_LABELS={cranberry:"ボルドー",fir:"モミの木",snow:"スノー",midnight:"星空"};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const state={
  sort:"new",style:"all",page:0,total:0,items:[],hasMore:false,
  loading:false,submitting:false,reportId:null,lastPostedId:null,
  wishLights:new Set(),toastTimeout:null,search:""
};
try{state.wishLights=new Set(JSON.parse(localStorage.getItem("snowletter-lights")||"[]"))}catch{}
const fmt=new Intl.NumberFormat("ja-JP");
const cardPositions=[
  [264,260],[220,269],[304,300],[182,372],[258,386],[335,368],
  [149,472],[205,489],[276,487],[330,487],[381,471],[260,333]
];

function toast(message,isError=false){
  const el=$("#toast");if(!el)return;
  el.textContent=message;el.classList.toggle("error",isError);el.classList.add("visible");
  clearTimeout(state.toastTimeout);
  state.toastTimeout=setTimeout(()=>el.classList.remove("visible"),4100);
}
async function request(action,{method="GET",params={},body}={}){
  const u=new URL(API);u.searchParams.set("action",action);
  for(const [key,val] of Object.entries(params)){if(val!=null)u.searchParams.set(key,String(val))}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(u,{method,mode:"cors",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:body?JSON.stringify(body):undefined,signal:controller.signal});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error||"通信がうまくいきませんでした。");
    return data;
  }catch(error){
    if(error?.name==="AbortError")throw new Error("通信がタイムアウトしました。再度お試しください。");
    throw error;
  }finally{clearTimeout(timeout)}
}
function readForm(){
  const form=$("#wishForm");
  return {
    name:$("#wishName").value.trim(),
    message:$("#wishMessage").value.trim(),
    style:form.elements.style.value,
    ornament:form.elements.ornament.value,
    website:$("#website").value
  };
}
function formPreview(){
  const data=readForm();
  const preview=$("#livePreview");
  preview.className="live-preview wish-card theme-"+data.style;
  $("#previewOrnament").textContent=ICONS[data.ornament]||"✦";
  $("#previewOrnament").dataset.emoji=/^(bell|gift|candy)$/.test(data.ornament)?"true":"false";
  $("#previewName").textContent=data.name||"あなた";
  $("#previewMessage").textContent=data.message||"あなたのメッセージが\nここに映ります。";
  const len=$("#wishMessage").value.length;
  $("#charCount").textContent=len+" / 280";
  $("#charCount").style.color=len>=270?"#a43e49":"";
}
function validateWish(data){
  if(!data.name||data.name.length>24)return "お名前を1〜24文字で入力してください。";
  if(data.message.length<2||data.message.length>280)return "メッセージは2〜280文字で入力してください。";
  if(/https?:\/\/|www\./i.test(data.name+" "+data.message))return "安全のためURLは投稿できません。";
  if(data.website)return "投稿を受け付けられませんでした。";
  return "";
}
function showFormError(message){
  const el=$("#formError");el.textContent=message;el.hidden=!message;
}
function updateStats(data){
  const wishes=Number(data.wishes||0),lights=Number(data.lights||0);
  $("#totalWishes").textContent=fmt.format(wishes);
  $("#totalLights").textContent=fmt.format(lights);
  $("#treeWishCount").textContent=fmt.format(wishes);
  $("#nextWishNumber").textContent=String(wishes+1).padStart(3,"0");
}
async function refreshStats(){
  try{const data=await request("stats");updateStats(data);return data}catch{return null}
}
function createText(tag,cls,value){
  const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value;return el;
}
function node(tag,cls){
  const el=document.createElement(tag);if(cls)el.className=cls;return el;
}
function dateLabel(value){
  const d=new Date(value);if(Number.isNaN(d.getTime()))return "";
  return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Tokyo"}).format(d);
}
function createCard(wish,index=0){
  const art=node("article","wall-card");
  art.id="wish-"+wish.id;
  art.style.animationDelay=Math.min(index*55,385)+"ms";
  const inner=node("div","wish-card theme-"+(STYLE_LABELS[wish.style]?wish.style:"cranberry"));
  inner.append(createText("div","card-topline","")); // text children below
  const top=inner.lastChild;
  top.append(createText("span",null,"FROM THE CHRISTMAS TREE"),createText("i",null,"2026"));
  const ornament=createText("span","card-ornament",ICONS[wish.ornament]||"✦");
  if(["bell","gift","candy"].includes(wish.ornament))ornament.dataset.emoji="true";
  inner.append(ornament);
  inner.append(createText("p","card-message",wish.message));
  const sig=node("div","card-signature");
  sig.append(createText("span",null,"WITH LOVE,"),createText("strong",null,wish.name));
  inner.append(sig,createText("span","card-corner","✳"));
  art.append(inner);

  const foot=node("div","card-foot");
  const time=createText("time",null,dateLabel(wish.createdAt));
  time.dateTime=wish.createdAt;
  const actions=node("div","card-actions");
  const light=node("button","light-button");
  light.type="button";light.setAttribute("aria-label",wish.name+"さんのメッセージに光を贈る");
  const alreadyLit=state.wishLights.has(wish.id);
  light.classList.toggle("lit",alreadyLit);light.setAttribute("aria-pressed",String(alreadyLit));
  light.append(createText("span","spark-icon",alreadyLit?"✦":"✧"),createText("span","light-number",fmt.format(wish.lights||0)));
  light.addEventListener("click",()=>addLight(wish,light));
  const share=node("button","report-button");share.type="button";
  share.title="メッセージを共有";share.setAttribute("aria-label","このメッセージのリンクをコピー");
  share.textContent="↗";share.addEventListener("click",()=>shareCard(wish.id));
  const report=node("button","report-button");report.type="button";
  report.title="不適切な内容を報告";report.setAttribute("aria-label","このメッセージを報告");
  report.textContent="⋯";report.addEventListener("click",()=>openReport(wish.id));
  actions.append(light,share,report);foot.append(time,actions);art.append(foot);
  return art;
}
function emptyState(message,title="まだメッセージがありません"){
  const el=node("div","empty-state");
  el.append(createText("span",null,"✧"),createText("h3",null,title),createText("p",null,message));
  return el;
}
function renderGrid(){
  const grid=$("#wishGrid"),q=state.search.trim().toLocaleLowerCase();
  const items=q?state.items.filter(p=>(p.name+" "+p.message).toLocaleLowerCase().includes(q)):state.items;
  grid.replaceChildren();
  if(!items.length){
    grid.append(emptyState(
      q?"読み込み済みの中では見つかりませんでした。\n「もっと見る」で続きを読み込めます。":"最初のひとつを、あなたが飾りませんか？",
      q?"一致するメッセージがありません":"最初の願いを待っています"
    ));
  }else{
    const fragment=document.createDocumentFragment();
    items.forEach((wish,i)=>fragment.append(createCard(wish,i)));
    grid.append(fragment);
  }
  $("#loadMore").hidden=!state.hasMore;
  const text=state.total?"公開メッセージ "+fmt.format(state.total)+"件":"新しいメッセージを待っています";
  $("#wallStatus").textContent=q?text+" · 読み込み済み "+fmt.format(items.length)+"件に一致":text;
  renderTreeOrnaments();
  const hash=location.hash.match(/^#wish-([a-f0-9-]{36})$/i);
  if(hash&&grid.querySelector("#wish-"+CSS.escape(hash[1]))){
    setTimeout(()=>grid.querySelector("#wish-"+CSS.escape(hash[1]))?.scrollIntoView({behavior:"smooth",block:"center"}),220);
  }
}
async function loadWishes(reset=false){
  if(state.loading)return;
  state.loading=true;
  if(reset){
    state.page=0;state.items=[];state.hasMore=false;
    $("#wishGrid").replaceChildren(...[1,2,3].map(()=>node("div","skeleton-card")));
    $("#wallStatus").textContent="メッセージを読み込んでいます…";
    $("#loadMore").hidden=true;
  }else{
    $("#loadMore").disabled=true;$("#loadMore").textContent="読み込み中…";
  }
  try{
    const data=await request("messages",{params:{page:state.page,limit:12,sort:state.sort,style:state.style}});
    const known=new Set(state.items.map(x=>x.id));
    const more=(data.items||[]).filter(x=>!known.has(x.id));
    state.items=state.page===0?data.items:state.items.concat(more);
    state.total=data.total;state.hasMore=data.hasMore;state.page++;
    renderGrid();
  }catch(error){
    if(reset){
      $("#wishGrid").replaceChildren(emptyState("通信に失敗しました。下の「最新のメッセージに更新」から再試行できます。","メッセージを読み込めません"));
      $("#wallStatus").textContent="通信エラー";
    }
    toast(error.message,true);
  }finally{
    state.loading=false;const more=$("#loadMore");more.disabled=false;more.textContent="もっとメッセージを見る ↓";
  }
}
async function addLight(wish,button){
  if(button.disabled)return;
  if(state.wishLights.has(wish.id)){
    toast("このメッセージにはもう光を届けています ✦");return;
  }
  button.disabled=true;
  try{
    const data=await request("light",{method:"POST",body:{id:wish.id}});
    wish.lights=Number(data.lights||wish.lights);
    state.wishLights.add(wish.id);
    try{localStorage.setItem("snowletter-lights",JSON.stringify([...state.wishLights].slice(-500)))}catch{}
    button.classList.add("lit");button.setAttribute("aria-pressed","true");
    $(".spark-icon",button).textContent="✦";
    $(".light-number",button).textContent=fmt.format(wish.lights);
    if(data.added){toast("ひとつ、光を届けました ✦");refreshStats()}
    else toast("このメッセージにはすでに光を届けています ✦");
  }catch(error){toast(error.message,true)}
  finally{button.disabled=false}
}
function svgEl(name,attrs={}){
  const el=document.createElementNS("http://www.w3.org/2000/svg",name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
  return el;
}
function renderTreeOrnaments(){
  const g=$("#communityOrnaments");if(!g)return;
  const wishList=state.items.slice(0,cardPositions.length);
  g.replaceChildren();
  wishList.forEach((wish,i)=>{
    const [x,y]=cardPositions[i],fill={
      cranberry:"#dc7182",fir:"#83b79a",snow:"#f8e2b8",midnight:"#8cb5df"
    }[wish.style]||"#e3bc77";
    const outer=svgEl("g",{class:"community-ornament",transform:"translate("+x+" "+y+")",
      style:"--swing:"+(3.1+i*.17)+"s"});
    const line=svgEl("path",{d:"M0 -13 L0 -25",stroke:"#d2aa66","stroke-width":"1.7"});
    const ball=svgEl("circle",{cx:0,cy:0,r:12,fill,stroke:"#e8d4a3","stroke-width":"1.5"});
    const highlight=svgEl("circle",{cx:-4,cy:-5,r:2.3,fill:"#fff",opacity:".68"});
    const title=svgEl("title");title.textContent=wish.name+"さんのメッセージ";
    outer.append(title,line,ball,highlight);
    outer.style.cursor="pointer";
    outer.addEventListener("click",()=>document.getElementById("wish-"+wish.id)?.scrollIntoView({behavior:"smooth",block:"center"}));
    g.append(outer);
  });
}
function openReport(id){
  state.reportId=id;const dialog=$("#reportDialog");
  if(dialog?.showModal)dialog.showModal();else dialog?.setAttribute("open","");
}
async function submitReport(){
  if(!state.reportId)return;
  const button=$("#submitReport");button.disabled=true;
  try{
    await request("report",{method:"POST",body:{id:state.reportId,reason:$("#reportReason").value}});
    $("#reportDialog").close();toast("報告を受け付けました。ご協力ありがとうございます。");
  }catch(error){toast(error.message,true)}
  finally{button.disabled=false;state.reportId=null}
}
async function shareCard(id){
  const url=new URL(location.href);url.hash="wish-"+id;
  try{await navigator.clipboard.writeText(url.toString());toast("このメッセージのリンクをコピーしました ✦")}
  catch{location.hash="wish-"+id;toast("メッセージへのリンクを表示しました ✦")}
}
function snow(){
  const area=$("#snowfall");if(!area||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const count=window.innerWidth<700?34:55;
  const fragment=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const flake=node("span","snowflake"),v=(n)=>((Math.sin(i*31.37+n)*10000)%1+1)%1;
    flake.style.setProperty("--x",(v(1)*100).toFixed(2)+"%");
    flake.style.setProperty("--size",(1.3+v(2)*3.1).toFixed(1)+"px");
    flake.style.setProperty("--duration",(10+v(3)*18).toFixed(1)+"s");
    flake.style.setProperty("--delay",(-v(4)*29).toFixed(1)+"s");
    flake.style.setProperty("--drift",(-70+v(5)*150).toFixed(0)+"px");
    flake.style.setProperty("--alpha",(0.20+v(6)*.54).toFixed(2));
    fragment.append(flake);
  }
  area.append(fragment);
}
function tickClock(){
  const localParts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric"})
    .formatToParts(new Date());
  const get=(type)=>Number(localParts.find(x=>x.type===type)?.value||0);
  const year=get("year"),month=get("month"),day=get("day");
  const christmasToday=month===12&&day===25;
  const nextYear=month===12&&day>25?year+1:year;
  const target=Date.parse(nextYear+"-12-25T00:00:00+09:00");
  let diff=christmasToday?0:Math.max(0,target-Date.now());
  const days=Math.floor(diff/86400000);diff%=86400000;
  const hours=Math.floor(diff/3600000);diff%=3600000;
  const minutes=Math.floor(diff/60000);diff%=60000;
  const seconds=Math.floor(diff/1000);
  [["days",days],["hours",hours],["minutes",minutes],["seconds",seconds]]
    .forEach(([id,value])=>{$("#"+id).textContent=String(value).padStart(2,"0")});
  if(christmasToday)$(".countdown-label").textContent="✦ MERRY CHRISTMAS ✦";
}
function sprinkles(){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const cx=window.innerWidth/2,cy=window.innerHeight/2;
  for(let i=0;i<24;i++){
    const s=node("span");s.textContent=i%3===0?"✧":"✦";
    Object.assign(s.style,{position:"fixed",zIndex:"180",pointerEvents:"none",color:i%2?"#f3cf94":"#ffffff",
      fontSize:(12+i%7*3)+"px",left:cx+"px",top:cy+"px",transition:"transform 1.05s ease-out,opacity 1.05s ease-out"});
    document.body.append(s);
    requestAnimationFrame(()=>{
      const a=i*2.399,r=75+((i*23)%155);
      s.style.transform="translate("+Math.cos(a)*r+"px,"+Math.sin(a)*r+"px) rotate("+(120+i*19)+"deg)";
      s.style.opacity="0";
    });
    setTimeout(()=>s.remove(),1200);
  }
}
async function submitForm(event){
  event.preventDefault();if(state.submitting)return;
  const data=readForm(),error=validateWish(data);
  showFormError(error);if(error){toast(error,true);return}
  state.submitting=true;const button=$("#submitWish"),label=$("#submitLabel");
  button.disabled=true;button.classList.add("loading");label.textContent="ツリーに飾っています…";
  try{
    const response=await request("post",{method:"POST",body:data});
    state.lastPostedId=response.wish.id;
    try{localStorage.setItem("snowletter-name",data.name)}catch{}
    $("#wishMessage").value="";formPreview();showFormError("");
    await Promise.allSettled([loadWishes(true),refreshStats()]);
    $("#successDialog").showModal?.();sprinkles();
  }catch(error){showFormError(error.message);toast(error.message,true)}
  finally{state.submitting=false;button.disabled=false;button.classList.remove("loading");label.textContent="ツリーにメッセージを飾る"}
}
function shareSite(){
  const url=location.origin+location.pathname;
  if(navigator.share){
    navigator.share({title:"Snowletter — みんなのクリスマスツリー",text:"あなたのメッセージも飾ってみよう 🎄",url}).catch(()=>{});
  }else{
    navigator.clipboard?.writeText(url).then(()=>toast("サイトのリンクをコピーしました ✦")).catch(()=>toast("サイトをシェアしてみよう ✦"));
  }
}
function initEvents(){
  const form=$("#wishForm");
  form.addEventListener("input",formPreview);form.addEventListener("change",formPreview);
  form.addEventListener("submit",submitForm);
  $("#loadMore").addEventListener("click",()=>loadWishes());
  $("#refreshWishes").addEventListener("click",()=>{loadWishes(true);refreshStats()});
  $$(".sort-tabs button").forEach(btn=>btn.addEventListener("click",()=>{
    if(state.sort===btn.dataset.sort)return;
    state.sort=btn.dataset.sort;
    $$(".sort-tabs button").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-pressed",String(b===btn))});
    loadWishes(true);
  }));
  $("#cardFilter").addEventListener("change",e=>{state.style=e.target.value;loadWishes(true)});
  let searchTimer;
  $("#wishSearch").addEventListener("input",e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=e.target.value;renderGrid()},180)});
  $("#cancelReport").onclick=()=>$("#reportDialog").close();
  $("#submitReport").onclick=submitReport;
  $("#viewMyWish").onclick=()=>{
    $("#successDialog").close();
    location.hash="#wish-"+state.lastPostedId;
    document.getElementById("wish-"+state.lastPostedId)?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  $("#shareWish").onclick=shareSite;
  $("#successDialog").addEventListener("click",e=>{if(e.target===$("#successDialog"))$("#successDialog").close()});
  $("#reportDialog").addEventListener("click",e=>{if(e.target===$("#reportDialog"))$("#reportDialog").close()});
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden){tickClock();refreshStats();if(state.page<=1)loadWishes(true)}
  });
}
async function boot(){
  try{$("#wishName").value=localStorage.getItem("snowletter-name")||""}catch{}
  formPreview();snow();tickClock();initEvents();
  setInterval(()=>{if(!document.hidden)tickClock()},1000);
  await Promise.allSettled([loadWishes(true),refreshStats()]);
  setInterval(()=>{if(!document.hidden&&!state.submitting){refreshStats();if(state.page<=1)loadWishes(true)}},60000);
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();