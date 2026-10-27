/* Kiru's Blueprint: UI */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),2600)};
const {CATALOG,uid,fmtN,fmtBytes}=BP;
const W=196,H=58;
const titleCase=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
const AVC=["#2457d6","#ff6b2c","#169a5a","#7044d4","#c98a00","#d92d3a","#0e7490","#be185d"];
const EPC=["#2457d6","#ff6b2c","#169a5a","#7044d4","#c98a00","#0e7490","#be185d","#4d7c0f"];
const STATUSES=[["todo","To do"],["doing","In progress"],["review","Review"],["done","Done"]];
const EXAMPLES=["Design a ride-hailing app like Uber for 5M daily users with live tracking and payments","URL shortener handling 10K requests per second","RAG chatbot over our company docs on AWS","E-commerce store with search, payments and recommendations","Chat app like WhatsApp for 50 million users with media sharing","Food delivery app in India for 2 crore users"];

async function confirmBox(title,msg,yes="Confirm"){const d=$("#dlgConfirm");$("#cfT").textContent=title;$("#cfM").textContent=msg;$("#cfYes").textContent=yes;d.returnValue="";d.showModal();return new Promise(r=>d.addEventListener("close",()=>r(d.returnValue==="yes"),{once:true}))}

// ── projects ──
function sampleTeam(){return [
  {id:uid(),name:"Asha",skills:{Backend:5,Data:3},capacity:13},
  {id:uid(),name:"Ravi",skills:{Frontend:5,Mobile:3},capacity:13},
  {id:uid(),name:"Meera",skills:{DevOps:4,Backend:3},capacity:10},
  {id:uid(),name:"Tom",skills:{QA:4,Frontend:2},capacity:10},
  {id:uid(),name:"Lin",skills:{ML:4,Data:4},capacity:10}]}
function blank(){return {id:uid(),name:"Untitled design",updated:Date.now(),design:{nodes:[],edges:[],doc:null,inputs:{dau:1e6,act:20,kb:1,rw:10,years:5},multi:false,domain:null},chat:[],board:{team:sampleTeam(),epics:[],tasks:[]}}}
let projects=store.get("bp.projects",{});
let P=projects[store.get("bp.current","")]||null;
if(!P){P=blank();projects[P.id]=P}
let saveT=0;
function save(){P.updated=Date.now();projects[P.id]=P;clearTimeout(saveT);$("#saved").textContent="Saving…";
  saveT=setTimeout(()=>{const ok=store.set("bp.projects",projects)&&store.set("bp.current",P.id);$("#saved").textContent=ok?"Saved "+new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"Not saved: browser storage is full"},350)}
function open(id){P=projects[id];store.set("bp.current",id);sel=null;undoStack=[];$("#pname").value=P.name;renderChat();renderAll();fit();renderBoard()}
$("#pname").addEventListener("input",e=>{P.name=e.target.value||"Untitled design";save()});

// ── undo ──
let undoStack=[];
function snap(){undoStack.push(JSON.stringify(P.design));if(undoStack.length>50)undoStack.shift()}
function undo(){if(!undoStack.length){toast("Nothing to undo");return}P.design=JSON.parse(undoStack.pop());sel=null;renderAll();save();toast("Undone")}

// ── chat ──
let quick=[];
function say(role,text){P.chat.push({r:role,t:text,ts:Date.now()});renderChat();save()}
function renderChat(){
  const m=$("#msgs");
  if(!P.chat.length){P.chat.push({r:"b",t:"Hi Kiru! Tell me what you're building, the way you'd explain it to a colleague: who uses it, how many, and anything special (real-time, payments, search, AI…).\n\nI'll draw the architecture, write the design doc and estimate capacity. Then you can change anything by just asking, like \"add a cache\", \"use Kafka instead of SQS\" or \"scale to 50M users\"."});quick=EXAMPLES.slice(0,4).map(e=>({l:e,v:e}))}
  m.innerHTML=P.chat.map(c=>`<div class="msg ${c.r}">${c.r==="b"?fmt(c.t):esc(c.t)}</div>`).join("");
  $("#quick").innerHTML=quick.length?quick.map((q,i)=>q.lab?`<span class="qlab">${esc(q.lab)}</span>`:`<button class="qr" data-q="${i}">${esc(q.l)}</button>`).join(""):"";
  m.scrollTop=m.scrollHeight;
}
const fmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
function typing(on){const m=$("#msgs");$(".typing")?.remove();if(on){m.insertAdjacentHTML("beforeend",'<div class="typing"><i></i><i></i><i></i></div>');m.scrollTop=m.scrollHeight}}
$("#quick").addEventListener("click",e=>{const b=e.target.closest("[data-q]");if(!b)return;const q=quick[+b.dataset.q];if(q.fn){q.fn();return}send(q.v)});
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const v=$("#chatIn").value.trim();if(!v)return;$("#chatIn").value="";autoGrow();send(v)});
const autoGrow=()=>{const t=$("#chatIn");t.style.height="auto";t.style.height=Math.min(140,t.scrollHeight)+"px"};
$("#chatIn").addEventListener("input",autoGrow);
$("#chatIn").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit()}});

async function send(text){
  say("u",text);quick=[];renderChat();typing(true);
  const ai=store.get("bp.ai",{on:"off"});
  try{
    if(ai.on==="on"&&ai.key){await aiTurn(text,ai)}
    else{await new Promise(r=>setTimeout(r,380));engineTurn(text)}
  }catch(err){typing(false);say("b","I couldn't reach Claude ("+(err.message||"network error")+"), so I used the built-in engine instead.");engineTurn(text)}
  typing(false);
}

// ── built-in conversational engine ──
const hasDesign=()=>P.design.nodes.length>0;
const nodeBy=pred=>P.design.nodes.find(pred);
function engineTurn(text){
  typing(false);
  const t=text.toLowerCase().trim();
  const isNew=/^(please\s+)?(design|build|create|architect|make|draft|sketch|i need|i want|we need|we want|let'?s build|help me (design|build))\b/.test(t)||/like (uber|whatsapp|netflix|youtube|twitter|instagram|airbnb|amazon|dropbox|slack|doordash|swiggy|zomato|bitly)/.test(t);
  if(!hasDesign()||(isNew&&(BP.detectDomain(t)||t.split(/\s+/).length>5))){newDesign(text);return}
  if(/^(help|what can you do|commands)/.test(t)){say("b",helpText());return}
  if(/^undo\b/.test(t)){undo();say("b","Undid the last change.");return}
  if(/test case|edge case|test plan|qa plan|how (do|should) we test/.test(t)){openSpecTab("tests");const n=BP.testCases(prof(),P.design).length;say("b",`I generated **${n} test cases** covering functional, negative, edge, performance, resilience and security${prof().genai?", plus GenAI checks for grounding, injection, privacy and regressions":""}. They're in the **Tests & edge cases** tab, where you can add your own.`);followups();return}
  if(/\b(detail(ed)?|deep.?dive|low.?level|lld|zoom into|internals?)\b/.test(t)){const nm=t.replace(/.*?(detail(ed)? design|deep.?dive|low.?level design|lld|zoom into|internals)\s*(of|for|into|on)?\s*(the\s+)?/,"").replace(/[?.!]$/,"").trim();
    const n=nm&&!/^(design|the design|it|everything|all|system)?$/.test(nm)?P.design.nodes.find(x=>x.name.toLowerCase().includes(nm))||P.design.nodes.find(x=>x.type===(BP.findTech(nm)?.type||BP.findType(nm))):null;
    if(n){sel={k:"n",id:n.id};renderCanvas();openSpecTab("detail");const dd=BP.detail(n,P.design,prof());say("b",`**${n.name}** (${n.tech}), detailed:

**Scaling:** ${dd.scale}
**Failure handling:** ${dd.fail}
**Security:** ${dd.sec.join(" ")}
**Observability:** ${dd.obs}

The full write-up is in the Detailed design tab.`)}
    else{openDetailDialog();say("b",`Opened the **detailed design** for all ${P.design.nodes.length} components: interfaces, scaling, failure handling, security and observability for each. Ask "detailed design of the payment service" to zoom into one.`)}
    followups();return}
  if(/which model|best model|what model|model (choice|selection)|llm choice|choose (a|the) model/.test(t)){if(!prof().genai){say("b","This design doesn't use an AI model yet. Say \"add an LLM\" or describe the AI feature, and I'll recommend models.");return}openSpecTab("genai");const m=BP.modelAdvice(prof());say("b",`My recommendation is **routing**, not a single model:\n\n${m.rows.slice(0,3).map(r=>`• **${r.m}**: ${r.use.split(":")[0]}`).join("\n")}\n\n${m.routing.slice(0,3).map(x=>"→ "+x).join("\n")}\n\n${m.note}`);followups();return}
  if(/hallucinat|genai best|gen ai best|best practice|guardrail|prompt injection|grounding/.test(t)){if(!prof().genai){P.design.profile={...prof(),genai:true}}openSpecTab("genai");const g=BP.genaiPractices(prof());say("b",`Key practices against hallucination:\n\n${g[1].items.map(x=>"• "+x).join("\n")}\n\nThe full checklist (grounding, injection defence, evals, operations) is in the **GenAI & models** tab.`);followups();return}
  if(/bank(ing)?.?grade|for a bank|banking|regulated|compliance|pci|sox|glba|make it secure|security review|hipaa/.test(t)){snap();const pf=prof();if(/bank|pci|sox|glba|regulated|financial/.test(t))pf.industry="banking";else if(/hipaa/.test(t))pf.industry="healthcare";P.design.profile=pf;P.design.source=(P.design.source||"")+" "+text;const added=BP.harden(P.design,pf);added.forEach(placeNew);BP.enrich(P.design,P.design.source);renderAll();save();openSpecTab("security");
    say("b",`${added.length?`Added ${added.map(n=>"**"+n.name+"**").join(", ")}. `:""}The **Security** tab now lists ${BP.securityControls(pf,P.design).length} controls${pf.industry==="banking"?", including PCI DSS scope reduction, data residency, audit retention and third-party risk":""}. New requirements and trade-offs were added to the doc too.`);followups();return}
  if(/\b(task|stories|story|backlog|break ?down|jira|sprint|tickets?)\b/.test(t)){goBacklog();return}
  if(/instead of|replace|swap|switch (to|from)|change .* to|migrate to|move to|use \w[\w .+-]* (for|as)\b/.test(t)){swapTech(text);return}
  if(/^(add|include|introduce|put|plus|also add|we need a|need an?)\b/.test(t)||/\badd (an?|the|some)?\s*\w+/.test(t)){addFromText(text);return}
  if(/\b(remove|delete|drop|get rid of|don'?t need)\b/.test(t)){removeFromText(text);return}
  if(/\brename\b/.test(t)){renameFromText(text);return}
  const sc=BP.parseScale(text);if(sc){setScale(sc);return}
  if(/multi.?region|global|worldwide|geo.?redundan/.test(t)){setMulti(true);return}
  if(/single.?region|one region/.test(t)){setMulti(false);return}
  if(/read.?heavy/.test(t)){setRW(100);return} if(/write.?heavy/.test(t)){setRW(.5);return} if(/balanced/.test(t)){setRW(5);return}
  if(/strong(ly)? consisten|acid|transaction/.test(t)){setConsistency(true);return} if(/eventual/.test(t)){setConsistency(false);return}
  if(/explain|walk me through|how does|flow|overview|summar/.test(t)){say("b",explain());followups();return}
  if(/bottleneck|risk|fail|weak|single point|spof|what could go wrong/.test(t)){say("b",risks());followups();return}
  if(/capacity|estimate|how many server|qps|storage|bandwidth|cost/.test(t)){say("b",capText());followups();return}
  if(/tidy|layout|arrange|clean up/.test(t)){snap();BP.layout(P.design);renderAll();fit();save();say("b","Tidied the layout into tiers: clients → edge → gateway → services → async → data → analytics.");return}
  const feats=BP.detectFeatures(t);
  if(feats.length){addFeatures(feats);return}
  if(BP.detectDomain(t)){newDesign(text);return}
  say("b","I'm not sure what to change. Try things like:\n• \"add a search index\" or \"remove the CDN\"\n• \"use DynamoDB instead of Postgres\"\n• \"scale to 20M daily users\" or \"make it multi-region\"\n• \"explain the flow\", \"what are the bottlenecks?\"\n• \"break this into tasks\"");
}
const prof=()=>P.design.profile||(P.design.profile=BP.profileOf(P.design.source||"",P.design));
function openSpecTab(k){renderSpec(k);mobileShow("spec")}
function helpText(){return "Here's what I understand:\n• **Describe a system**: \"Design a food delivery app for 2M users with live tracking\"\n• **Add / remove**: \"add Kafka\", \"add a notifications service\", \"remove the cache\"\n• **Swap tech**: \"use Cassandra instead of Postgres\", \"switch to GCP\"\n• **Scale**: \"10M daily users\", \"5K requests per second\", \"make it multi-region\"\n• **Shape**: \"it's read-heavy\", \"needs strong consistency\"\n• **Understand**: \"explain the flow\", \"bottlenecks\", \"capacity\"\n• **Go deeper**: \"detailed design of the payment service\", \"test cases\", \"which model should we use\", \"hallucination best practices\", \"make it banking grade\"\n• **Deliver**: \"break this into tasks\" builds the backlog on the Delivery Board\n\nYou can also drag, connect and edit anything directly on the diagram."}
function newDesign(text){
  if(hasDesign()){const old=JSON.parse(JSON.stringify(P));old.id=uid();old.name=P.name+" (earlier)";projects[old.id]=old}
  snap();
  const d=BP.buildDesign(text);const prof=BP.profileOf(text,d);BP.harden(d,prof);BP.layout(d);
  P.design={nodes:d.nodes,edges:d.edges,doc:d.doc,inputs:d.inputs,multi:d.multi,domain:d.domain,source:text};BP.enrich(P.design,text);
  if(prof.industry==="banking"&&!/bank/i.test(d.name))d.name="Banking "+d.name;if(P.name==="Untitled design"||/\(earlier\)$/.test(P.name)||hasDesign())P.name=d.name;$("#pname").value=P.name;
  sel=null;renderAll();fit();save();
  const c=BP.capacity(d.inputs,d.multi),svc=d.nodes.filter(n=>n.type==="service");
  const db=d.nodes.find(n=>n.type==="sql"||n.type==="nosql");
  const extras=d.nodes.filter(n=>["cache","queue","stream","search","geo","ws","ml","llm","vector","blob","notify"].includes(n.type)).map(n=>n.name.toLowerCase());
  say("b",`Here's a first cut of ${/^[aeiou]/i.test(d.name)?"an":"a"} **${d.name}** with ${d.nodes.length} components.\n\n**Core services:** ${svc.map(s=>s.name).join(", ")}.\n**Data:** ${db?db.name+" on "+db.tech:"—"}${extras.length?`, plus ${extras.slice(0,6).join(", ")}`:""}.\n**Rough load:** ~${fmtN(d.inputs.dau)} daily users → ~${fmtN(c.peak)} requests/sec at peak, ~${fmtBytes(c.storYr)} of new data a year.\n\n${prof.industry==="banking"?"\n**Banking-grade:** added WAF, HSM-backed keys and an immutable audit log; security controls are in the Security tab.":""}${prof.genai?"\n**GenAI:** added guardrails with PII redaction, a re-ranker and LLM evals. Model choice and anti-hallucination practices are in the GenAI & models tab.":""}

A few questions to sharpen it:`);
  quick=[{lab:"How many daily users?"},...["100K","1M","10M","100M"].map(v=>({l:v+" users",v:v+" daily users"})),{lab:"Traffic shape"},{l:"Read-heavy",v:"it's read-heavy"},{l:"Write-heavy",v:"it's write-heavy"},{lab:"Consistency & reach"},{l:"Strong consistency",v:"needs strong consistency"},{l:"Eventual is fine",v:"eventual consistency is fine"},{l:"Multi-region",v:"make it multi-region"}];
  quick.push({lab:"Go deeper"},{l:"Detailed design",v:"show the detailed design"},{l:"Test cases",v:"show test cases and edge cases"},...(prof.genai?[{l:"Best model?",v:"which model should we use"}]:[]),...(prof.industry==="banking"?[]:[{l:"Make it bank-grade",v:"make it banking grade"}]),{l:"Create the backlog",v:"break this into tasks"});
  renderChat();
}
function followups(){quick=[{l:"Explain the flow",v:"explain the flow"},{l:"Detailed design",v:"show the detailed design"},{l:"Test cases",v:"show test cases and edge cases"},...(prof().genai?[{l:"Best model?",v:"which model should we use"}]:[]),{l:"Bottlenecks?",v:"what are the bottlenecks"},{l:"Create the backlog",v:"break this into tasks"}];renderChat()}
function smartLink(n){
  const D=P.design,by=t=>D.nodes.filter(x=>x.type===t&&x!==n),svc=by("service"),link=(a,b,label,async)=>{if(a&&b&&a!==b&&!D.edges.some(e=>e.from===a.id&&e.to===b.id))D.edges.push({id:uid(),from:a.id,to:b.id,label:label||"",async:!!async})};
  const primary=by("sql")[0]||by("nosql")[0],gw=by("gateway")[0],client=by("client")[0],lb=by("lb")[0],queue=by("queue")[0],worker=by("worker")[0],stream=by("stream")[0];
  switch(n.type){
    case "cache":svc.slice(0,4).forEach(s=>link(s,n,"cache-aside"));break;
    case "sql":case "nosql":svc.forEach(s=>link(s,n,"read/write"));break;
    case "queue":svc.slice(0,2).forEach(s=>link(s,n,"enqueue",true));if(worker)link(n,worker,"consume",true);break;
    case "stream":svc.forEach(s=>link(s,n,"publish events",true));break;
    case "worker":link(queue||stream,n,"consume",true);if(primary)link(n,primary,"update");break;
    case "search":link(svc[0],n,"query");if(stream)link(stream,n,"index updates",true);break;
    case "cdn":link(client,n,"static & media");if(by("blob")[0])link(n,by("blob")[0],"origin");break;
    case "lb":link(client,n,"HTTPS");if(gw)link(n,gw,"");break;
    case "gateway":link(lb||client,n,"");svc.forEach(s=>link(n,s,"REST/gRPC"));break;
    case "ws":link(client,n,"WebSocket");link(svc[0],n,"push updates",true);break;
    case "auth":link(gw||svc[0],n,"verify token");break;
    case "service":link(gw||lb||client,n,"REST/gRPC");if(primary)link(n,primary,"read/write");break;
    case "notify":link(worker||queue||svc[0],n,"send",true);break;
    case "blob":link(svc[0],n,"signed URLs");if(by("cdn")[0])link(by("cdn")[0],n,"origin");break;
    case "dwh":link(stream||primary,n,"ETL / CDC",true);break;
    case "monitor":link(gw||svc[0],n,"telemetry",true);break;
    case "scheduler":link(n,queue||svc[0],"trigger",true);break;
    case "client":link(n,lb||gw,"HTTPS");break;
    default:link(svc[0],n,"")}
}
function placeNew(n){const tier=CATALOG[n.type].tier;const same=P.design.nodes.filter(x=>x!==n&&(CATALOG[x.type]?.tier)===tier);n.x=40+tier*260;n.y=same.length?Math.max(...same.map(s=>s.y))+96:40}
function addNode(type,name,tech,desc){snap();const c=CATALOG[type];const n={id:uid(),type,name:name||c.l,tech:tech||c.tech[0],desc:desc||"",notes:""};P.design.nodes.push(n);placeNew(n);smartLink(n);sel={k:"n",id:n.id};renderAll();save();return n}
function addFromText(text){
  const ph=text.replace(/^(please\s+)?(also\s+)?(add|include|introduce|put in|plus|we need|need)\s+(an?\s+|the\s+|some\s+)?/i,"").replace(/[.!]$/,"").trim();
  const tech=BP.findTech(ph);let type=tech?.type||BP.findType(ph);
  let name=null;
  if(!type||(type==="service"&&!/^(a\s+)?service$/i.test(ph))){type="service";name=titleCase(ph.replace(/\b(service|microservice)\b/i,"").trim())+" service"}
  else if(!tech&&ph.split(/\s+/).length>=2&&ph.length<40&&["ml","worker","external","notify","scheduler","nosql","sql","search","llm"].includes(type))name=titleCase(ph);
  if(type==="sql"&&/^(a\s+)?(database|db)$/i.test(ph))type=P.design.nodes.some(n=>n.type==="sql")?"nosql":"sql";
  const n=addNode(type,name||(tech?CATALOG[type].l:undefined),tech?.tech);
  if(type==="llm"||/ai|llm|assistant|chatbot/i.test(ph)){const pf=prof();pf.genai=true;P.design.source=(P.design.source||"")+" llm";BP.harden(P.design,pf).forEach(placeNew);BP.enrich(P.design,P.design.source);renderAll();save()}
  const links=P.design.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>nodeName(e.from===n.id?e.to:e.from));
  say("b",`Added **${n.name}** (${n.tech})${links.length?` and connected it to ${links.slice(0,4).join(", ")}`:""}. Drag it anywhere, or edit it in the Inspect tab.`);
  followups();
}
function addFeatures(feats){
  const map={realtime:"ws",geo:"geo",notify:"notify",blob:"blob",search:"search",recommend:"ml",analytics:"dwh",cache:"cache",queue:"queue",stream:"stream",scheduler:"scheduler",llm:"llm",vector:"vector",fraud:"ml",maps:"external",payment:"external",multiregion:null};
  const added=[];feats.forEach(f=>{const t=map[f];if(!t||P.design.nodes.some(n=>n.type===t&&!(t==="ml"||t==="external")))return;const nm=f==="recommend"?"Recommendation model":f==="fraud"?"Fraud model":f==="maps"?"Maps & routing API":f==="payment"?"Payment provider":undefined;added.push(addNode(t,nm,f==="payment"?"Stripe":f==="maps"?"Google Maps":undefined).name)});
  if(feats.includes("multiregion"))setMulti(true,true);
  say("b",added.length?`Added ${added.join(", ")} for that.`:"Looks like the design already covers that. Ask me to \"explain the flow\" to see how.");followups();
}
function removeFromText(text){
  const ph=text.replace(/^.*?\b(remove|delete|drop|get rid of|don'?t need)\s+(the\s+|an?\s+)?/i,"").replace(/[.!]$/,"").trim().toLowerCase();
  let n=P.design.nodes.find(x=>x.name.toLowerCase()===ph)||P.design.nodes.find(x=>x.name.toLowerCase().includes(ph))||P.design.nodes.find(x=>ph.includes(x.name.toLowerCase().replace(/ service$/,"")));
  if(!n){const t=BP.findTech(ph)?.type||BP.findType(ph);if(t)n=P.design.nodes.find(x=>x.type===t)}
  if(!n){say("b",`I couldn't find "${ph}" in the design. Components: ${P.design.nodes.map(n=>n.name).join(", ")}.`);return}
  deleteNode(n.id);say("b",`Removed **${n.name}** and its connections.`);followups();
}
function renameFromText(text){const m=text.match(/rename\s+(?:the\s+)?(.+?)\s+(?:to|as)\s+(.+)/i);if(!m){say("b","Try \"rename Order service to Checkout service\".");return}
  const n=P.design.nodes.find(x=>x.name.toLowerCase().includes(m[1].toLowerCase().trim()));if(!n){say("b",`I couldn't find "${m[1]}".`);return}snap();const old=n.name;n.name=m[2].replace(/[.!]$/,"").trim();renderAll();save();say("b",`Renamed ${old} to **${n.name}**.`)}
function swapTech(text){
  const t=text.toLowerCase();
  const cloud=/\bgcp\b|google cloud/.test(t)?"gcp":/\baws\b|amazon web/.test(t)?"aws":/azure/.test(t)?"azure":null;
  if(cloud&&/switch|move|migrate|use|to/.test(t)){snap();const pick={aws:{cdn:"CloudFront",lb:"AWS ALB",gateway:"AWS API Gateway",queue:"Amazon SQS",stream:"Amazon Kinesis",nosql:"DynamoDB",sql:"Amazon Aurora",blob:"Amazon S3",dwh:"Redshift",ml:"SageMaker",notify:"Amazon SNS",monitor:"CloudWatch",auth:"Amazon Cognito",llm:"Amazon Bedrock"},gcp:{cdn:"Cloudflare",lb:"GCP Load Balancer",gateway:"Apigee",queue:"Google Pub/Sub",nosql:"Bigtable",sql:"Cloud Spanner",blob:"Google Cloud Storage",dwh:"BigQuery",ml:"Vertex AI",llm:"Vertex AI",monitor:"OpenTelemetry"},azure:{queue:"Azure Service Bus",blob:"Azure Blob",monitor:"OpenTelemetry"}}[cloud];
    let c=0;P.design.nodes.forEach(n=>{if(pick[n.type]){n.tech=pick[n.type];c++}});renderAll();save();say("b",`Switched ${c} components to ${cloud.toUpperCase()} services.`);followups();return}
  const m=t.match(/use\s+(.+?)\s+instead of\s+(.+)/)||t.match(/replace\s+(.+?)\s+with\s+(.+)/)||t.match(/swap\s+(.+?)\s+(?:for|with)\s+(.+)/)||t.match(/switch\s+(?:from\s+)?(.+?)\s+to\s+(.+)/)||t.match(/(?:change|migrate|move)\s+(.+?)\s+to\s+(.+)/);
  let newPh,oldPh;
  if(m){if(/instead of/.test(t)){newPh=m[1];oldPh=m[2]}else{oldPh=m[1];newPh=m[2]}}
  else{const u=t.match(/use\s+(.+?)\s+(?:for|as)\s+(?:the\s+)?(.+)/);if(u){newPh=u[1];oldPh=u[2]}}
  if(!newPh){say("b","Try \"use Kafka instead of SQS\" or \"replace Postgres with DynamoDB\".");return}
  const nt=BP.findTech(newPh);const ot=BP.findTech(oldPh)||{type:BP.findType(oldPh)};
  if(!nt){say("b",`I don't know "${newPh}" yet. You can type any technology into a component's Tech field in the Inspect tab.`);return}
  snap();
  let target=P.design.nodes.filter(n=>ot.tech?n.tech===ot.tech:n.type===ot.type);
  if(!target.length)target=P.design.nodes.filter(n=>n.type===nt.type);
  if(!target.length){addNode(nt.type,undefined,nt.tech);say("b",`There was no ${oldPh} in the design, so I added **${nt.tech}** as a new ${CATALOG[nt.type].l.toLowerCase()}.`);return}
  target.forEach(n=>{if(n.type!==nt.type){n.type=nt.type;n.name=n.name.match(/primary/i)?n.name:CATALOG[nt.type].l}n.tech=nt.tech});
  renderAll();save();
  const note=nt.type==="nosql"&&ot.type==="sql"?" Heads up: you lose joins and multi-row transactions, so model tables around your queries.":nt.type==="sql"&&ot.type==="nosql"?" You gain transactions and joins; plan for sharding or read replicas at scale.":nt.type==="stream"&&ot.type==="queue"?" Kafka keeps an ordered, replayable log, which is great for multiple consumers but more to operate.":nt.type==="queue"&&ot.type==="stream"?" A queue is simpler to run, but messages are gone once consumed (no replay).":"";
  say("b",`Switched ${target.map(n=>n.name).join(", ")} to **${nt.tech}**.${note}`);followups();
}
function setScale(sc){snap();const i=P.design.inputs;if(sc.dau)i.dau=sc.dau;if(sc.qps)i.dau=sc.qps*86400/(i.act||20);renderAll();save();const c=BP.capacity(i,P.design.multi);
  const adds=[];if(c.peak>5000&&!P.design.nodes.some(n=>n.type==="cache")){addNode("cache");adds.push("a cache")}
  if(c.peak>20000&&!P.design.nodes.some(n=>n.type==="queue"||n.type==="stream")){addNode("stream");adds.push("an event stream")}
  say("b",`Updated to ~${fmtN(i.dau)} daily users: ~${fmtN(c.peak)} req/s at peak, ~${c.servers} app servers, ~${fmtBytes(c.storYr)} new data per year${adds.length?`. At that load I also added ${adds.join(" and ")}`:""}.`);followups()}
function setMulti(on,quiet){snap();P.design.multi=on;const d=P.design.doc;if(d){const k="Multi-region: active-active across regions with geo-DNS routing";d.nfr=d.nfr.filter(x=>!x.startsWith("Multi-region"));if(on)d.nfr.push(k)}
  if(on&&!P.design.nodes.some(n=>n.type==="cdn"))addNode("cdn");renderAll();save();
  if(!quiet){say("b",on?"Made it **multi-region**: geo-DNS sends users to the nearest healthy region, data replicates across regions, and I doubled the capacity estimate. Decide which data can be written in any region and which needs a home region.":"Back to a **single region**. Keep cross-region backups for disaster recovery.");followups()}}
function setRW(rw){snap();P.design.inputs.rw=rw;if(rw>=20&&!P.design.nodes.some(n=>n.type==="cache"))addNode("cache");
  if(rw<1){const db=P.design.nodes.find(n=>n.type==="sql");if(db){db.type="nosql";db.tech="Cassandra";db.name="Primary datastore"}}
  renderAll();save();say("b",rw>=20?"Read-heavy: reads go through the cache first, and the database gets read replicas.":rw<1?"Write-heavy: moved the primary store to Cassandra (wide-column, built for high write throughput), and writes go through the event stream.":"Balanced read/write noted in the capacity model.");followups()}
function setConsistency(strong){snap();const db=P.design.nodes.find(n=>n.type==="sql"||n.type==="nosql"&&/primary/i.test(n.name));
  if(strong&&db&&db.type==="nosql"){db.type="sql";db.tech="PostgreSQL";db.name="Primary database"}
  const d=P.design.doc;if(d){d.nfr=d.nfr.filter(x=>!x.startsWith("Consistency"));d.nfr.push(strong?"Consistency: strong (ACID transactions) for core writes":"Consistency: eventual is acceptable; reads may lag writes by seconds")}
  renderAll();save();say("b",strong?"Strong consistency: the primary store is relational (PostgreSQL) with transactions. Use idempotency keys for retries and keep cross-service flows as sagas.":"Eventual consistency: you can lean on caches, replicas and async events more freely.");followups()}
const nodeName=id=>P.design.nodes.find(n=>n.id===id)?.name||"?";
function explain(){
  const D=P.design,ty=t=>D.nodes.filter(n=>n.type===t);const names=t=>ty(t).map(n=>n.name).join(", ");
  const steps=[];
  if(ty("client").length)steps.push(`Users open the **${names("client")}**${ty("cdn").length?`; static files and media come from the **CDN**`:""}.`);
  if(ty("lb").length||ty("gateway").length)steps.push(`API calls hit the **${ty("lb").length?"load balancer":"gateway"}**, then the **API gateway** checks the token${ty("auth").length?" with the auth service":""} and routes the request.`);
  if(ty("service").length)steps.push(`**${names("service")}** handle the business logic.`);
  const dbs=[...ty("sql"),...ty("nosql")];if(dbs.length)steps.push(`They read and write **${dbs.map(n=>n.name+" ("+n.tech+")").join(", ")}**${ty("cache").length?`, with **${ty("cache")[0].tech}** in front for hot reads`:""}.`);
  if(ty("ws").length)steps.push(`Live updates go out through the **realtime gateway** over WebSockets.`);
  if(ty("queue").length||ty("stream").length)steps.push(`Slow or follow-up work goes async: services publish to **${[...ty("queue"),...ty("stream")].map(n=>n.tech).join(" / ")}**${ty("worker").length?", and workers process it":""}${ty("notify").length?", including notifications":""}.`);
  if(ty("search").length)steps.push(`**Search** is served from ${ty("search")[0].tech}, kept in sync from events.`);
  if(ty("llm").length)steps.push(`AI features call the **LLM gateway** (${ty("llm")[0].tech})${ty("vector").length?", grounded with documents from the vector DB":""}.`);
  if(ty("dwh").length)steps.push(`Events land in the **${ty("dwh")[0].tech}** warehouse for reporting.`);
  if(ty("monitor").length)steps.push(`Everything emits metrics, logs and traces to **${ty("monitor")[0].tech}**.`);
  return "Here's how a request flows:\n\n"+steps.map((s,i)=>`${i+1}. ${s}`).join("\n");
}
function risks(){const r=(P.design.doc?.risks||[]).slice(0,6);const c=BP.capacity(P.design.inputs,P.design.multi);const extra=[];
  if(!P.design.nodes.some(n=>n.type==="cache")&&P.design.inputs.rw>=10)extra.push("No cache on a read-heavy workload, so the database takes every read.");
  if(P.design.nodes.filter(n=>n.type==="sql").length===1&&c.wqps>3000)extra.push(`~${fmtN(c.wqps)} writes/s on a single SQL primary is near its limit: shard or move hot writes to a NoSQL store.`);
  if(!P.design.multi)extra.push("Single region: a regional outage takes everything down.");
  return "Things I'd watch:\n\n"+[...extra,...r].map(x=>"• "+x).join("\n")}
function capText(){const i=P.design.inputs,c=BP.capacity(i,P.design.multi);
  return `Back-of-envelope for ~${fmtN(i.dau)} daily users × ${i.act} actions:\n\n• **${fmtN(c.reqDay)}** requests/day → **${fmtN(c.avg)}** avg, **${fmtN(c.peak)}** peak req/s\n• Reads ~${fmtN(c.rqps)}/s, writes ~${fmtN(c.wqps)}/s\n• New data ~**${fmtBytes(c.storYr)}/year**; ~${fmtBytes(c.total)} over ${i.years} years with 3× replication${P.design.multi?" across 2 regions":""}\n• Peak bandwidth ~${fmtBytes(c.bw)}/s\n• ~**${c.servers}** app servers at ~800 req/s each\n• Cache for the hottest 20% of daily reads: ~${c.cacheGB<1?"<1":c.cacheGB.toFixed(0)} GB\n\nTweak the inputs in the Capacity tab.`}

// ── AI mode (Anthropic Messages API, user's own key) ──
async function callClaude(ai,system,user){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":ai.key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:ai.model||"claude-sonnet-5-5",max_tokens:4000,system,messages:[{role:"user",content:user}]})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||("HTTP "+r.status));
  return j.content.map(c=>c.text||"").join("");
}
const jsonOf=t=>{const m=t.match(/```json\s*([\s\S]+?)```/)||t.match(/(\{[\s\S]*\})/);return JSON.parse(m?m[1]:t)};
async function aiTurn(text,ai){
  const types=Object.keys(CATALOG).join("|");
  const sys=`You are a senior system design partner inside a diagramming app. Reply ONLY with JSON:
{"reply":"short conversational answer (markdown **bold** allowed, no headings)","design":null or {"name":str,"nodes":[{"id":str,"type":"${types}","name":str,"tech":str,"desc":str}],"edges":[{"from":id,"to":id,"label":str,"async":bool}],"doc":{"fr":[str],"nfr":[str],"apis":[{"m":str,"p":str,"d":str}],"ents":[{"n":str,"f":str}],"trade":[str],"risks":[str]},"inputs":{"dau":num,"act":num,"kb":num,"rw":num,"years":num},"multi":bool},"quick":[up to 4 short follow-up suggestions]}
Return "design" whenever the architecture should change (full updated design, keep existing ids for unchanged nodes). Return null for pure questions. Use realistic, specific technologies. 8–22 nodes. Extra node types allowed: waf, guard, kms, eval, rerank. For banking/regulated systems include WAF, HSM-backed keys (kms), audit log and private connectivity. For GenAI include guardrails with PII redaction, retrieval + re-ranking, evals, and model routing (Claude Haiku for routing, Sonnet as default, Opus for hard/high-risk cases); address hallucination with grounding, citations and abstention.`;
  const cur=hasDesign()?JSON.stringify({name:P.name,nodes:P.design.nodes.map(({id,type,name,tech,desc})=>({id,type,name,tech,desc})),edges:P.design.edges.map(({from,to,label,async})=>({from,to,label,async})),doc:P.design.doc,inputs:P.design.inputs,multi:P.design.multi}):"none";
  const hist=P.chat.slice(-8).map(c=>(c.r==="u"?"User: ":"Assistant: ")+c.t).join("\n");
  const out=jsonOf(await callClaude(ai,sys,`Current design JSON: ${cur}\n\nRecent conversation:\n${hist}\n\nUser: ${text}`));
  typing(false);
  if(out.design&&Array.isArray(out.design.nodes)){
    snap();const pos=Object.fromEntries(P.design.nodes.map(n=>[n.id,[n.x,n.y]]));
    const nodes=out.design.nodes.filter(n=>CATALOG[n.type]).map(n=>({id:String(n.id||uid()),type:n.type,name:n.name||CATALOG[n.type].l,tech:n.tech||CATALOG[n.type].tech[0],desc:n.desc||"",notes:""}));
    const ids=new Set(nodes.map(n=>n.id));
    const edges=(out.design.edges||[]).filter(e=>ids.has(String(e.from))&&ids.has(String(e.to))).map(e=>({id:uid(),from:String(e.from),to:String(e.to),label:e.label||"",async:!!e.async}));
    const fresh=nodes.some(n=>!pos[n.id]);
    P.design={source:(P.design.source||"")+" "+text,profile:P.design.profile,nodes,edges,doc:out.design.doc||P.design.doc,inputs:Object.assign({dau:1e6,act:20,kb:1,rw:10,years:5},P.design.inputs,out.design.inputs||{}),multi:!!out.design.multi,domain:"ai"};
    if(fresh)BP.layout(P.design);nodes.forEach(n=>{if(pos[n.id]&&!fresh){[n.x,n.y]=pos[n.id]}});
    if(out.design.name&&(P.name==="Untitled design"||!hasDesign()))P.name=out.design.name;$("#pname").value=P.name;
    BP.enrich(P.design,P.design.source);renderAll();if(fresh)fit();save();
  }
  say("b",out.reply||"Done.");quick=(out.quick||[]).slice(0,4).map(q=>({l:q,v:q}));renderChat();
}

// ── canvas ──
const svg=$("#svg"),world=$("#world");
let view={x:20,y:60,k:1},sel=null,connect=false,connSrc=null,drag=null;
function applyView(){world.setAttribute("transform",`translate(${view.x},${view.y}) scale(${view.k})`);$("#zv").textContent=Math.round(view.k*100)+"%"}
function port(a,b){const ax=a.x+W/2,ay=a.y+H/2,bx=b.x+W/2,by=b.y+H/2;const dx=bx-ax,dy=by-ay;
  if(Math.abs(dx)>=Math.abs(dy)*1.2){const s=dx>0?1:-1;return [[ax+s*W/2,ay],[bx-s*W/2,by],"h"]}
  const s=dy>0?1:-1;return [[ax,ay+s*H/2],[bx,by-s*H/2],"v"]}
function edgePath(a,b){const [[x1,y1],[x2,y2],o]=port(a,b);const c=o==="h"?Math.max(40,Math.abs(x2-x1)/2):Math.max(30,Math.abs(y2-y1)/2);
  const p=o==="h"?`M${x1},${y1} C${x1+(x2>x1?c:-c)},${y1} ${x2-(x2>x1?c:-c)},${y2} ${x2},${y2}`:`M${x1},${y1} C${x1},${y1+(y2>y1?c:-c)} ${x2},${y2-(y2>y1?c:-c)} ${x2},${y2}`;
  return {p,mx:(x1+x2)/2,my:(y1+y2)/2}}
const COLORS={0:"#64748b",1:"#0e7490",2:"#2457d6",3:"#7044d4",4:"#c98a00",5:"#169a5a",6:"#be185d"};
function renderCanvas(){
  const D=P.design,by=Object.fromEntries(D.nodes.map(n=>[n.id,n]));
  $("#edges").innerHTML=D.edges.map(e=>{const a=by[e.from],b=by[e.to];if(!a||!b)return"";const {p,mx,my}=edgePath(a,b);const s=sel?.k==="e"&&sel.id===e.id;const lw=Math.max(0,e.label.length*6.4+10);
    return `<g class="edge${e.async?" async":""}${s?" sel":""}" data-e="${e.id}"><path d="${p}" marker-end="url(#${s?"arrS":"arr"})"/><path class="hit" d="${p}"/>${e.label?`<rect x="${mx-lw/2}" y="${my-9}" width="${lw}" height="16" rx="4"/><text x="${mx}" y="${my+3}" text-anchor="middle">${esc(e.label)}</text>`:""}</g>`}).join("");
  $("#nodes").innerHTML=D.nodes.map(n=>{const c=CATALOG[n.type]||CATALOG.service,col=COLORS[c.tier];const s=sel?.k==="n"&&sel.id===n.id;
    return `<g class="node${s?" sel":""}${connSrc===n.id?" src":""}" data-n="${n.id}" transform="translate(${n.x},${n.y})"><rect class="box" width="${W}" height="${H}" rx="12"/><rect width="5" height="${H-16}" x="0" y="8" rx="2" fill="${col}"/><text x="16" y="${H/2+7}" font-size="20">${c.ic}</text><text class="nm" x="46" y="25">${esc(trunc(n.name,22))}</text><text class="tc" x="46" y="42">${esc(trunc(n.tech,25))}</text></g>`}).join("");
  $("#emptyCanvas").hidden=D.nodes.length>0;
}
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+"…":s;
function fit(){const N=P.design.nodes;if(!N.length){view={x:20,y:60,k:1};applyView();return}
  const r=svg.getBoundingClientRect();if(!r.width)return;const minX=Math.min(...N.map(n=>n.x)),minY=Math.min(...N.map(n=>n.y)),maxX=Math.max(...N.map(n=>n.x+W)),maxY=Math.max(...N.map(n=>n.y+H));
  const k=Math.min(1.3,Math.max(.25,Math.min((r.width-40)/(maxX-minX),(r.height-110)/(maxY-minY))));view={k,x:(r.width-(maxX-minX)*k)/2-minX*k,y:60+(r.height-80-(maxY-minY)*k)/2-minY*k};applyView()}
function toWorld(e){const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left-view.x)/view.k,y:(e.clientY-r.top-view.y)/view.k}}
svg.addEventListener("pointerdown",e=>{
  $("#palette").hidden=true;
  const ng=e.target.closest(".node"),eg=e.target.closest(".edge");
  if(ng){const id=ng.dataset.n;
    if(connect){if(!connSrc){connSrc=id;renderCanvas();return}if(connSrc!==id){snap();if(!P.design.edges.some(x=>x.from===connSrc&&x.to===id))P.design.edges.push({id:uid(),from:connSrc,to:id,label:"",async:false});const eid=P.design.edges.at(-1).id;connSrc=null;sel={k:"e",id:eid};renderAll();save();toast("Connected. Add a label in Inspect.")}return}
    sel={k:"n",id};const n=P.design.nodes.find(x=>x.id===id);const w=toWorld(e);drag={mode:"node",n,dx:w.x-n.x,dy:w.y-n.y,moved:false,pre:JSON.stringify(P.design)};svg.setPointerCapture(e.pointerId);renderCanvas();renderSpec("inspect");return}
  if(eg){sel={k:"e",id:eg.dataset.e};renderCanvas();renderSpec("inspect");return}
  if(connSrc){connSrc=null}
  sel=null;drag={mode:"pan",sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};svg.classList.add("panning");svg.setPointerCapture(e.pointerId);renderCanvas();renderSpec(curSpec==="inspect"?"inspect":curSpec);
});
svg.addEventListener("pointermove",e=>{if(!drag)return;
  if(drag.mode==="node"){const w=toWorld(e);drag.n.x=Math.round((w.x-drag.dx)/8)*8;drag.n.y=Math.round((w.y-drag.dy)/8)*8;drag.moved=true;renderCanvas()}
  else{view.x=drag.vx+(e.clientX-drag.sx);view.y=drag.vy+(e.clientY-drag.sy);applyView()}});
svg.addEventListener("pointerup",()=>{if(drag?.mode==="node"&&drag.moved){undoStack.push(drag.pre);save()}drag=null;svg.classList.remove("panning")});
svg.addEventListener("wheel",e=>{e.preventDefault();const r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const k2=Math.min(2.5,Math.max(.2,view.k*(e.deltaY<0?1.1:.9)));view.x=mx-(mx-view.x)*k2/view.k;view.y=my-(my-view.y)*k2/view.k;view.k=k2;applyView()},{passive:false});
svg.addEventListener("dblclick",e=>{const ng=e.target.closest(".node");if(ng){sel={k:"n",id:ng.dataset.n};renderSpec("inspect");setTimeout(()=>$("#fName")?.select(),0);mobileShow("spec")}});
const zoomBy=f=>{const r=svg.getBoundingClientRect(),mx=r.width/2,my=r.height/2,k2=Math.min(2.5,Math.max(.2,view.k*f));view.x=mx-(mx-view.x)*k2/view.k;view.y=my-(my-view.y)*k2/view.k;view.k=k2;applyView()};
$("#zIn").onclick=()=>zoomBy(1.2);$("#zOut").onclick=()=>zoomBy(1/1.2);$("#fitBtn").onclick=fit;
$("#layoutBtn").onclick=()=>{snap();BP.layout(P.design);renderAll();fit();save()};
$("#undoBtn").onclick=undo;
$("#connBtn").onclick=()=>{connect=!connect;connSrc=null;$("#connBtn").setAttribute("aria-pressed",connect);$("#canvasWrap").classList.toggle("connect",connect);$("#connHint").hidden=!connect;renderCanvas()};
$("#delBtn").onclick=()=>delSelected();
function delSelected(){if(!sel){toast("Select a component or connection first");return}if(sel.k==="n"){const n=P.design.nodes.find(x=>x.id===sel.id);deleteNode(sel.id);toast(`Removed ${n?.name}`)}else{snap();P.design.edges=P.design.edges.filter(e=>e.id!==sel.id);sel=null;renderAll();save()}}
function deleteNode(id){snap();P.design.nodes=P.design.nodes.filter(n=>n.id!==id);P.design.edges=P.design.edges.filter(e=>e.from!==id&&e.to!==id);if(sel?.id===id)sel=null;renderAll();save()}
document.addEventListener("keydown",e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if((e.key==="Delete"||e.key==="Backspace")&&!typing&&sel&&!$("#studio").hidden){e.preventDefault();delSelected()}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"&&!typing){e.preventDefault();undo()}
  if(e.key==="Escape"){if(connect)$("#connBtn").click();$("#palette").hidden=true;$("#expMenu").hidden=true}});
// palette
function renderPalette(){const groups=[["Clients & edge",[0,1,2]],["Services",[3]],["Async",[4]],["Data",[5]],["Analytics & ops",[6]]];
  $("#palette").innerHTML=groups.map(([t,tiers])=>`<div class="t">${t}</div>`+Object.entries(CATALOG).filter(([,c])=>tiers.includes(c.tier)).map(([k,c])=>`<button data-add="${k}"><span style="font-size:18px">${c.ic}</span>${c.l}</button>`).join("")).join("")}
$("#addBtn").onclick=()=>{const p=$("#palette");p.hidden=!p.hidden;$("#addBtn").setAttribute("aria-expanded",!p.hidden)};
$("#palette").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;const n=addNode(b.dataset.add);$("#palette").hidden=true;renderSpec("inspect");toast(`Added ${n.name}. Auto-connected where it fits.`)});

// ── spec panel ──
const SPEC_TABS=[["inspect","Inspect"],["detail","Detailed design"],["req","Requirements"],["cap","Capacity"],["api","APIs"],["data","Data model"],["security","Security"],["genai","GenAI & models"],["tests","Tests & edge cases"],["trade","Trade-offs"]];
let curSpec="inspect";
function renderSpec(tab){if(tab)curSpec=tab;
  $("#stabs").innerHTML=SPEC_TABS.map(([k,l])=>`<button role="tab" data-st="${k}" aria-selected="${curSpec===k}">${l}</button>`).join("");
  const s=$("#spec"),D=P.design,doc=D.doc;
  if(!hasDesign()&&curSpec!=="inspect"){s.innerHTML=`<p class="sub">Describe a system in the chat to generate this section.</p>`;return}
  if(curSpec==="inspect"){
    if(sel?.k==="n"){const n=D.nodes.find(x=>x.id===sel.id);if(!n){sel=null;return renderSpec()}const c=CATALOG[n.type];
      const ins=D.edges.filter(e=>e.to===n.id),outs=D.edges.filter(e=>e.from===n.id);
      s.innerHTML=`<h3>${c.ic} ${esc(n.name)}</h3><p class="sub">${c.l} · tier ${c.tier}</p>
       <div class="fld"><label for="fName">Name</label><input id="fName" data-f="name" value="${esc(n.name)}"></div>
       <div class="fld"><label for="fType">Type</label><select id="fType" data-f="type">${Object.entries(CATALOG).map(([k,v])=>`<option value="${k}"${k===n.type?" selected":""}>${v.ic} ${v.l}</option>`).join("")}</select></div>
       <div class="fld"><label for="fTech">Technology</label><input id="fTech" data-f="tech" list="techList" value="${esc(n.tech)}"><datalist id="techList">${c.tech.map(t=>`<option value="${esc(t)}">`).join("")}</datalist></div>
       <div class="fld"><label for="fDesc">Responsibility</label><textarea id="fDesc" data-f="desc">${esc(n.desc)}</textarea></div>
       <div class="fld"><label for="fNotes">Scaling & ops notes</label><textarea id="fNotes" data-f="notes" placeholder="e.g. 3 replicas per AZ, autoscale at 60% CPU, p99 SLO 150 ms">${esc(n.notes||"")}</textarea></div>
       <div class="fld"><label>Connections</label>${[...ins.map(e=>["← from",e.from,e]),...outs.map(e=>["→ to",e.to,e])].map(([d,id,e])=>`<div class="row"><span class="pill">${d}</span><span style="flex:1;min-width:0">${esc(nodeName(id))}${e.label?` <span style="color:var(--ink-3)">· ${esc(e.label)}</span>`:""}</span><button class="x" data-rmedge="${e.id}" aria-label="Remove connection">×</button></div>`).join("")||'<span class="note" style="margin:0">No connections yet. Use ↗ Connect on the canvas.</span>'}</div>
       <div class="row"><button class="btn sm" id="dupNode">⧉ Duplicate</button><button class="btn sm" id="connFrom">↗ Connect from here</button><button class="btn sm" id="rmNode" style="margin-left:auto;color:var(--red)">🗑 Delete</button></div>`;
    } else if(sel?.k==="e"){const e=D.edges.find(x=>x.id===sel.id);if(!e){sel=null;return renderSpec()}
      s.innerHTML=`<h3>Connection</h3><p class="sub">${esc(nodeName(e.from))} → ${esc(nodeName(e.to))}</p>
       <div class="fld"><label for="eLabel">Label</label><input id="eLabel" value="${esc(e.label)}" placeholder="e.g. REST, publish events, read/write"></div>
       <div class="fld"><label><input type="checkbox" id="eAsync" ${e.async?"checked":""} style="width:auto"> Asynchronous (dashed)</label></div>
       <div class="row"><button class="btn sm" id="eRev">⇄ Reverse</button><button class="btn sm" id="eDel" style="margin-left:auto;color:var(--red)">🗑 Delete</button></div>`;
    } else {const counts={};D.nodes.forEach(n=>{const t=CATALOG[n.type].tier;counts[t]=(counts[t]||0)+1});
      s.innerHTML=hasDesign()?`<h3>${esc(P.name)}</h3><p class="sub">${D.nodes.length} components · ${D.edges.length} connections${D.multi?" · multi-region":""}</p>
        <div class="cap">${[["Clients & edge",(counts[0]||0)+(counts[1]||0)+(counts[2]||0)],["Services",counts[3]||0],["Async",counts[4]||0],["Data stores",counts[5]||0]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <p class="note" style="margin-top:0">Click a component or arrow to edit it. Double-click a component to rename it. Drag the empty canvas to pan; scroll to zoom.</p>
        <div class="fld"><label>Components</label>${D.nodes.map(n=>`<div class="row" style="cursor:pointer" data-pick="${n.id}"><span>${CATALOG[n.type].ic}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.name)}</span><span class="pill">${esc(trunc(n.tech,16))}</span></div>`).join("")}</div>`
        :`<h3>Nothing selected</h3><p class="sub">Start in the chat, pick a template, or add a component from the toolbar.</p>`}
    return}
  if(curSpec==="detail"){const n=(sel?.k==="n"&&D.nodes.find(x=>x.id===sel.id))||D.nodes.find(x=>x.type==="service")||D.nodes[0];
    s.innerHTML=`<h3>Detailed design</h3><p class="sub">Low-level view of one component. Pick another below, click one on the canvas, or open the whole system.</p>
     <div class="row"><select id="ddPick" aria-label="Component">${D.nodes.map(x=>`<option value="${x.id}"${x.id===n.id?" selected":""}>${CATALOG[x.type].ic} ${esc(x.name)}</option>`).join("")}</select></div>
     <div class="row"><button class="btn sm ink" id="ddAll">📖 Full detailed design</button></div>${lldHtml(BP.detail(n,D,prof()),n)}`;return}
  if(curSpec==="security"){const pf=prof(),c=BP.securityControls(pf,D);
    s.innerHTML=`<h3>Security & compliance</h3><div class="prof"><span class="pill">${pf.industry==="banking"?"🏦 Banking profile":pf.industry==="healthcare"?"🏥 Healthcare profile":"General profile"}</span>${pf.genai?'<span class="pill">✨ GenAI</span>':""}</div>
     ${pf.industry==="general"?`<p class="sub">Building for a bank or another regulated business? <button class="btn sm" id="mkBank">🏦 Make it banking-grade</button></p>`:`<p class="sub">Controls mapped for a regulated environment. Validate them with your security and compliance teams.</p>`}
     ${c.map(x=>`<div class="ctl"><b>${esc(x.k)}</b><span>${esc(x.v)}</span></div>`).join("")}`;return}
  if(curSpec==="genai"){const pf=prof();
    if(!pf.genai){s.innerHTML=`<h3>GenAI & models</h3><p class="sub">This design has no AI component yet.</p><button class="btn sm" id="mkAI">✨ Add an AI assistant to this design</button>`;return}
    const m=BP.modelAdvice(pf),g=BP.genaiPractices(pf);
    s.innerHTML=`<h3>Model selection</h3><p class="sub">${esc(m.note)}</p>${m.rows.map(r=>`<div class="mrow"><b>${esc(r.m)}</b><p><b style="font:600 12px var(--body)">Use for:</b> ${esc(r.use)}</p><p><b style="font:600 12px var(--body)">Why:</b> ${esc(r.why)}</p><p><b style="font:600 12px var(--body)">Watch:</b> ${esc(r.watch)}</p></div>`).join("")}
     <h3 style="margin-top:16px">Routing</h3><ol style="padding-left:18px;margin:6px 0 0;font-size:13px">${m.routing.map(x=>`<li style="margin-bottom:4px">${esc(x)}</li>`).join("")}</ol>
     <h3 style="margin-top:16px">Access & governance</h3><ul style="padding-left:18px;margin:6px 0 0;font-size:13px">${m.access.map(x=>`<li style="margin-bottom:4px">${esc(x)}</li>`).join("")}</ul>
     ${g.map(sec=>`<h3 style="margin-top:16px">${esc(sec.g)}</h3><ul style="padding-left:18px;margin:6px 0 0;font-size:13px">${sec.items.map(x=>`<li style="margin-bottom:4px">${esc(x)}</li>`).join("")}</ul>`).join("")}`;return}
  if(curSpec==="tests"){const pf=prof(),T=BP.testCases(pf,D),custom=doc.customTests||(doc.customTests=[]);const types=[...new Set(T.map(t=>t.type))];
    s.innerHTML=`<h3>Tests & edge cases</h3><p class="sub">${T.length} generated cases${types.length?": "+types.join(", "):""}. They update as the design changes.</p>
     <div class="row"><select id="tFilter" aria-label="Filter test type"><option value="">All types</option>${types.map(x=>`<option>${x}</option>`).join("")}</select></div>
     <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>ID</th><th>Type</th><th>Case</th><th>Expected</th></tr></thead><tbody id="tBody">${testRows(T,"")}</tbody></table></div>
     <h3 style="margin-top:16px">Your own cases</h3><p class="sub">Add scenarios specific to your business</p>${listEd("customTests",true)}`;return}
  if(curSpec==="req"){s.innerHTML=`<h3>Functional requirements</h3><p class="sub">What the system must do</p>${listEd("fr")}<h3 style="margin-top:18px">Non-functional requirements</h3><p class="sub">How well it must do it</p>${listEd("nfr")}`;return}
  if(curSpec==="trade"){s.innerHTML=`<h3>Key decisions & trade-offs</h3><p class="sub">Why the design looks like this</p>${listEd("trade",true)}<h3 style="margin-top:18px">Risks & bottlenecks</h3><p class="sub">What could break first and the mitigation</p>${listEd("risks",true)}`;return}
  if(curSpec==="api"){s.innerHTML=`<h3>API surface</h3><p class="sub">Main endpoints clients call</p>${doc.apis.map((a,i)=>`<div class="row"><select data-api="${i}" data-k="m" style="width:84px;flex:none">${["GET","POST","PUT","PATCH","DELETE","WS","MQTT","gRPC"].map(m=>`<option${m===a.m?" selected":""}>${m}</option>`).join("")}</select><input data-api="${i}" data-k="p" value="${esc(a.p)}" style="font-family:var(--mono);font-size:12px"><button class="x" data-rmapi="${i}" aria-label="Remove endpoint">×</button></div><div class="row" style="margin-top:-2px;margin-bottom:10px"><input data-api="${i}" data-k="d" value="${esc(a.d)}" placeholder="What it does"></div>`).join("")}<button class="add" id="addApi">＋ Endpoint</button>`;return}
  if(curSpec==="data"){s.innerHTML=`<h3>Data model</h3><p class="sub">Core entities and their fields</p>${doc.ents.map((en,i)=>`<div class="ent"><div class="row" style="margin:0"><input data-ent="${i}" data-k="n" value="${esc(en.n)}"><button class="x" data-rment="${i}" aria-label="Remove entity">×</button></div><textarea data-ent="${i}" data-k="f">${esc(en.f)}</textarea></div>`).join("")}<button class="add" id="addEnt">＋ Entity</button>`;return}
  if(curSpec==="cap"){const i=D.inputs,c=BP.capacity(i,D.multi);
    s.innerHTML=`<h3>Capacity estimate</h3><p class="sub">Change any input and everything recalculates</p>
     <div class="cap">${[["dau","Daily active users"],["act","Actions per user / day"],["rw","Reads per write"],["kb","Avg write size (KB)"],["years","Retention (years)"]].map(([k,l])=>`<div class="fld" style="margin:0"><label for="ci_${k}">${l}</label><input id="ci_${k}" type="number" min="0" step="any" data-cap="${k}" value="${i[k]}"></div>`).join("")}<div class="fld" style="margin:0"><label for="ciMulti">Regions</label><select id="ciMulti"><option value="0"${D.multi?"":" selected"}>Single region</option><option value="1"${D.multi?" selected":""}>Multi-region</option></select></div></div>
     <div class="cap" id="capOut">${capStats(c)}</div>
     <p class="note">Peak = 3× average. Storage counts writes only, ×3 for replication${D.multi?", ×2 for regions":""}. One app server ≈ 800 req/s. Cache sized for the hottest 20% of a day's reads.</p>`;return}
}
function testRows(T,f){return T.filter(t=>!f||t.type===f).map(t=>`<tr><td style="font:11px var(--mono);white-space:nowrap">${t.id}</td><td><span class="ttype ${t.type}">${t.type}</span></td><td><b style="font-weight:600">${esc(t.area)}</b><br>${esc(t.title)}</td><td>${esc(t.expect)}</td></tr>`).join("")}
function lldHtml(dd,n){const li=a=>a.length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"—";
  return `<div class="lld"><h4>${CATALOG[n.type].ic} ${esc(dd.name)}</h4><div class="meta">${esc(dd.type)} · ${esc(dd.tech)}</div><dl>
   <dt>Responsibility</dt><dd>${esc(dd.resp||"—")}</dd><dt>Called by</dt><dd>${li(dd.ins)}</dd><dt>Calls</dt><dd>${li(dd.outs)}</dd>
   ${dd.apis.length?`<dt>Endpoints</dt><dd>${li(dd.apis.map(a=>a.m+" "+a.p+" · "+a.d))}</dd>`:""}
   <dt>Scaling</dt><dd>${esc(dd.scale)}</dd><dt>Failure handling</dt><dd>${esc(dd.fail)}</dd><dt>Security</dt><dd>${li(dd.sec)}</dd><dt>Observability</dt><dd>${esc(dd.obs)}</dd>${dd.notes?`<dt>Your notes</dt><dd>${esc(dd.notes)}</dd>`:""}</dl></div>`}
function lldMd(){const D=P.design,pf=prof();return [`# ${P.name}: detailed design`,"",...D.nodes.map(n=>{const d=BP.detail(n,D,pf);return [`## ${d.name}`,`_${d.type} · ${d.tech}_`,"",`- **Responsibility:** ${d.resp}`,`- **Called by:** ${d.ins.join("; ")||"—"}`,`- **Calls:** ${d.outs.join("; ")||"—"}`,...(d.apis.length?[`- **Endpoints:** ${d.apis.map(a=>a.m+" "+a.p).join("; ")}`]:[]),`- **Scaling:** ${d.scale}`,`- **Failure handling:** ${d.fail}`,`- **Security:** ${d.sec.join(" ")}`,`- **Observability:** ${d.obs}`,...(d.notes?[`- **Notes:** ${d.notes}`]:[]),""].join("\n")})].join("\n")}
function openDetailDialog(){const D=P.design;if(!D.nodes.length){toast("Create a design first");return}const pf=prof();
  $("#ddSub").textContent=`${D.nodes.length} components · ${pf.industry==="banking"?"banking profile":"general profile"}${pf.genai?" · GenAI":""}`;
  const order=[...D.nodes].sort((a,b)=>CATALOG[a.type].tier-CATALOG[b.type].tier);
  $("#ddBody").innerHTML=order.map(n=>lldHtml(BP.detail(n,D,pf),n)).join("");$("#dlgDetail").showModal()}
$("#ddClose").onclick=()=>$("#dlgDetail").close();
$("#ddMd").onclick=()=>{download(slug()+"-detailed-design.md",new Blob([lldMd()],{type:"text/markdown"}));toast("Downloaded")};
function capStats(c){return [["Peak req/s",fmtN(c.peak)],["Avg req/s",fmtN(c.avg)],["Writes/s",fmtN(c.wqps)],["Reads/s",fmtN(c.rqps)],["New data / yr",fmtBytes(c.storYr)],["Total stored",fmtBytes(c.total)],["App servers",c.servers],["Cache size",(c.cacheGB<1?"<1":c.cacheGB.toFixed(0))+" GB"]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}
function listEd(key,area){const arr=P.design.doc[key]||[];return arr.map((v,i)=>`<div class="row">${area?`<textarea data-li="${key}" data-i="${i}" rows="2" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:7px 9px;background:var(--paper);resize:vertical">${esc(v)}</textarea>`:`<input data-li="${key}" data-i="${i}" value="${esc(v)}">`}<button class="x" data-rmli="${key}" data-i="${i}" aria-label="Remove">×</button></div>`).join("")+`<button class="add" data-addli="${key}">＋ Add</button>`}
$("#stabs").addEventListener("click",e=>{const b=e.target.closest("[data-st]");if(b)renderSpec(b.dataset.st)});
let editSnap=0;
$("#spec").addEventListener("input",e=>{const t=e.target,D=P.design;if(Date.now()-editSnap>1500){snap();editSnap=Date.now()}
  if(t.dataset.f&&sel?.k==="n"){const n=D.nodes.find(x=>x.id===sel.id);n[t.dataset.f]=t.value;if(t.dataset.f==="type"){n.tech=CATALOG[t.value].tech[0];renderSpec()}renderCanvas();save();return}
  if(t.id==="eLabel"){D.edges.find(x=>x.id===sel.id).label=t.value;renderCanvas();save();return}
  if(t.dataset.li){D.doc[t.dataset.li][+t.dataset.i]=t.value;save();return}
  if(t.dataset.api){D.doc.apis[+t.dataset.api][t.dataset.k]=t.value;save();return}
  if(t.dataset.ent){D.doc.ents[+t.dataset.ent][t.dataset.k]=t.value;save();return}
  if(t.dataset.cap){D.inputs[t.dataset.cap]=Math.max(0,parseFloat(t.value)||0);$("#capOut").innerHTML=capStats(BP.capacity(D.inputs,D.multi));save();return}
  if(t.id==="ciMulti"){D.multi=t.value==="1";$("#capOut").innerHTML=capStats(BP.capacity(D.inputs,D.multi));save()}
  if(t.id==="eAsync"){D.edges.find(x=>x.id===sel.id).async=t.checked;renderCanvas();save()}
});
$("#spec").addEventListener("change",e=>{if(e.target.id==="eAsync"){snap();P.design.edges.find(x=>x.id===sel.id).async=e.target.checked;renderCanvas();save()}if(e.target.id==="ciMulti"){P.design.multi=e.target.value==="1";$("#capOut").innerHTML=capStats(BP.capacity(P.design.inputs,P.design.multi));save()}});
$("#spec").addEventListener("change",e=>{if(e.target.id==="ddPick"){sel={k:"n",id:e.target.value};renderCanvas();renderSpec("detail")}if(e.target.id==="tFilter"){$("#tBody").innerHTML=testRows(BP.testCases(prof(),P.design),e.target.value)}});
$("#spec").addEventListener("click",e=>{const t=e.target,D=P.design;
  if(t.id==="ddAll"){openDetailDialog();return}
  if(t.id==="mkBank"){send("make it banking grade");mobileShow("chat");return}
  if(t.id==="mkAI"){send("add an LLM assistant with retrieval");mobileShow("chat");return}
  const pick=t.closest("[data-pick]");if(pick){sel={k:"n",id:pick.dataset.pick};renderCanvas();renderSpec();return}
  if(t.dataset.rmedge){snap();D.edges=D.edges.filter(x=>x.id!==t.dataset.rmedge);renderAll();save()}
  if(t.id==="rmNode")delSelected();
  if(t.id==="dupNode"){const n=D.nodes.find(x=>x.id===sel.id);snap();const c={...n,id:uid(),name:n.name+" copy",x:n.x+24,y:n.y+80};D.nodes.push(c);sel={k:"n",id:c.id};renderAll();save()}
  if(t.id==="connFrom"){if(!connect)$("#connBtn").click();connSrc=sel.id;renderCanvas();mobileShow("canvas");toast("Now click the target component")}
  if(t.id==="eDel")delSelected();
  if(t.id==="eRev"){snap();const ed=D.edges.find(x=>x.id===sel.id);[ed.from,ed.to]=[ed.to,ed.from];renderAll();save()}
  if(t.dataset.rmli){snap();D.doc[t.dataset.rmli].splice(+t.dataset.i,1);renderSpec();save()}
  if(t.dataset.addli){snap();D.doc[t.dataset.addli].push("");renderSpec();save();const ins=$$(`[data-li="${t.dataset.addli}"]`);ins.at(-1)?.focus()}
  if(t.dataset.rmapi){snap();D.doc.apis.splice(+t.dataset.rmapi,1);renderSpec();save()}
  if(t.id==="addApi"){snap();D.doc.apis.push({m:"GET",p:"/v1/",d:""});renderSpec();save()}
  if(t.dataset.rment){snap();D.doc.ents.splice(+t.dataset.rment,1);renderSpec();save()}
  if(t.id==="addEnt"){snap();D.doc.ents.push({n:"NewEntity",f:"id, created_at"});renderSpec();save()}
});
function renderAll(){renderCanvas();renderSpec();applyView()}

// ── board ──
const B=()=>P.board;
const mem=id=>B().team.find(m=>m.id===id);
const initials=n=>n.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const avc=id=>AVC[Math.max(0,B().team.findIndex(m=>m.id===id))%AVC.length];
let filt={a:"",e:"",s:""};
function isMobileClient(){return P.design.nodes.some(n=>n.type==="client"&&/native|ios|android|flutter|mobile/i.test(n.tech+n.name))}
function addEpic(goal,role){const e={id:uid(),goal,role,color:EPC[B().epics.length%EPC.length]};B().epics.push(e);return e}
async function breakStories(){
  const text=$("#storyIn").value.trim();if(!text){toast("Write a user story first");$("#storyIn").focus();return}
  const ai=store.get("bp.ai",{on:"off"});let made=0;
  const stories=BP.parseStories(text);
  if(ai.on==="on"&&ai.key){
    $("#breakBtn").textContent="Thinking…";
    try{const out=jsonOf(await callClaude(ai,`Break user stories into small, workable engineering tasks. Reply ONLY with JSON: {"stories":[{"goal":str,"role":str,"tasks":[{"title":str,"skill":"${BP.SKILLS.join("|")}","points":1|2|3|5|8|13,"desc":str,"ac":[str]}]}]}. 4–10 tasks per story, specific to the system design given.`,`System design components: ${P.design.nodes.map(n=>n.name+" ("+n.tech+")").join(", ")||"none yet"}\n\nStories:\n${text}`));
      out.stories.forEach(s=>{const ep=addEpic(s.goal,s.role||"user");s.tasks.forEach(t=>{B().tasks.push({id:uid(),title:t.title,skill:BP.SKILLS.includes(t.skill)?t.skill:"Backend",points:+t.points||3,desc:t.desc||"",ac:t.ac||[],status:"todo",assignee:null,why:"",epic:ep.id});made++})})}
    catch(err){toast("Claude unavailable ("+err.message+"); used the built-in engine")}
    $("#breakBtn").textContent="✂️ Break it down"}
  if(!made){stories.forEach(s=>{const ep=addEpic(s.goal,s.role);BP.breakDown(s,P.design,isMobileClient()).forEach(t=>{t.epic=ep.id;B().tasks.push(t);made++})})}
  BP.assign(B().tasks,B().team,true);
  $("#storyIn").value="";renderBoard();save();
  const pts=B().tasks.slice(-made).reduce((a,t)=>a+t.points,0);
  toast(`${stories.length} stor${stories.length===1?"y":"ies"} → ${made} tasks, ${pts} points, auto-assigned`);mobileShow("kb");
}
function fromDesign(){
  if(!hasDesign()){toast("Create a design in the Studio first");return}
  const eps=BP.backlogFromDesign(P.design,isMobileClient());let made=0;
  eps.forEach(e=>{const ep=addEpic(e.goal,e.role);e.tasks.forEach(t=>{t.epic=ep.id;B().tasks.push(t);made++})});
  BP.assign(B().tasks,B().team,true);renderBoard();save();toast(`${eps.length} epics, ${made} tasks from the design`);mobileShow("kb");
}
function goBacklog(){if(!hasDesign()){say("b","Describe a system first, then I can turn it into a backlog.");return}
  const before=B().tasks.length;fromDesign();const n=B().tasks.length-before;
  say("b",`Created **${n} tasks** across ${B().epics.length} epics on the Delivery Board, sized in story points and auto-assigned by skill and capacity. Add user stories there to get feature-level tasks.`);
  quick=[{l:"Open the board",v:"",fn:()=>showTab("board")}];renderChat()}
function renderBoard(){
  const b=B();
  // epics
  $("#epics").innerHTML=b.epics.length?b.epics.map(e=>{const ts=b.tasks.filter(t=>t.epic===e.id);const done=ts.filter(t=>t.status==="done").length;const pts=ts.reduce((a,t)=>a+t.points,0);
    return `<div class="epic" style="--ec:${e.color}"><div class="h"><span>${esc(e.goal.charAt(0).toUpperCase()+e.goal.slice(1))}</span><span>${done}/${ts.length} · ${pts} pts <button class="x" data-rmepic="${e.id}" aria-label="Delete epic and its tasks">×</button></span></div></div>`}).join(""):`<p style="margin:0;color:var(--ink-3);font-size:12.5px">No stories yet. Write one above, or build a backlog from your design.</p>`;
  // team
  $("#team").innerHTML=b.team.map((m,i)=>`<div class="mem"><span class="av" style="background:${AVC[i%AVC.length]}">${initials(m.name)}</span><div style="min-width:0"><input data-mname="${m.id}" value="${esc(m.name)}" aria-label="Name"><div class="skl">${BP.SKILLS.map(s=>`<button class="sk" data-sk="${m.id}" data-s="${s}" style="opacity:${m.skills[s]?1:.45}" title="Click to change level">${s} <b>${m.skills[s]||0}</b></button>`).join("")}</div></div><div style="text-align:right"><input class="capin" type="number" min="0" data-mcap="${m.id}" value="${m.capacity}" aria-label="Capacity in points"><div><button class="x" data-rmmem="${m.id}" aria-label="Remove person" style="border:0;background:none;color:var(--ink-3);cursor:pointer">remove</button></div></div></div>`).join("");
  // filters
  const fa=$("#fAssignee"),fe=$("#fEpic"),fs=$("#fSkill");
  fa.innerHTML=`<option value="">Everyone</option><option value="__none">Unassigned</option>`+b.team.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("");fa.value=filt.a;
  fe.innerHTML=`<option value="">All epics</option>`+b.epics.map(e=>`<option value="${e.id}">${esc(trunc(e.goal,30))}</option>`).join("");fe.value=filt.e;
  fs.innerHTML=`<option value="">All skills</option>`+BP.SKILLS.map(s=>`<option>${s}</option>`).join("");fs.value=filt.s;
  // load
  const load=Object.fromEntries(b.team.map(m=>[m.id,0]));b.tasks.forEach(t=>{if(t.assignee&&t.status!=="done"&&load[t.assignee]!=null)load[t.assignee]+=t.points});
  $("#load").innerHTML=b.team.map((m,i)=>{const over=load[m.id]>m.capacity;return `<div class="ld${over?" over":""}"><div class="h">${esc(m.name)}<span>${load[m.id]}/${m.capacity} pts</span></div><div class="tr"><div class="fl" style="width:${Math.min(100,load[m.id]/Math.max(1,m.capacity)*100)}%;${over?"":`background:${AVC[i%AVC.length]}`}"></div></div></div>`}).join("");
  const tot=b.tasks.filter(t=>t.status!=="done").reduce((a,t)=>a+t.points,0),cap=b.team.reduce((a,m)=>a+m.capacity,0),un=b.tasks.filter(t=>!t.assignee&&t.status!=="done").length,overN=b.team.filter(m=>load[m.id]>m.capacity).length;
  $("#sprintSum").textContent=`${tot} open pts · team capacity ${cap}${un?` · ${un} unassigned`:""}${overN?` · ${overN} over capacity`:""}`;
  // columns
  const vis=b.tasks.filter(t=>(!filt.a||(filt.a==="__none"?!t.assignee:t.assignee===filt.a))&&(!filt.e||t.epic===filt.e)&&(!filt.s||t.skill===filt.s));
  $("#cols").innerHTML=STATUSES.map(([k,l])=>{const ts=vis.filter(t=>t.status===k);return `<div class="col" data-col="${k}"><h5>${l}<span>${ts.length} · ${ts.reduce((a,t)=>a+t.points,0)} pts</span></h5><div class="list">${ts.map(tkCard).join("")||'<p style="margin:4px;color:var(--ink-3);font-size:12px">Drop tasks here</p>'}</div></div>`}).join("");
}
function tkCard(t){const e=B().epics.find(x=>x.id===t.epic),m=mem(t.assignee);
  return `<div class="tk" draggable="true" data-tk="${t.id}" style="--ec:${e?.color||"#8590a8"}" tabindex="0" role="button" aria-label="${esc(t.title)}"><div class="t">${esc(t.title)}</div><div class="m"><span class="pts">${t.points}</span><span class="skt">${t.skill}</span>${m?`<span class="av" style="background:${avc(m.id)}" title="${esc(m.name)}${t.why?" · "+esc(t.why):""}">${initials(m.name)}</span>`:'<span class="un">unassigned</span>'}</div></div>`}
let dragTk=null;
$("#cols").addEventListener("dragstart",e=>{const c=e.target.closest(".tk");if(!c)return;dragTk=c.dataset.tk;c.classList.add("dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",dragTk)}catch(_){}});
$("#cols").addEventListener("dragend",e=>{e.target.closest(".tk")?.classList.remove("dragging");$$(".col.drop").forEach(c=>c.classList.remove("drop"))});
$("#cols").addEventListener("dragover",e=>{const c=e.target.closest(".col");if(!c||!dragTk)return;e.preventDefault();$$(".col.drop").forEach(x=>x!==c&&x.classList.remove("drop"));c.classList.add("drop")});
$("#cols").addEventListener("drop",e=>{const c=e.target.closest(".col");if(!c||!dragTk)return;e.preventDefault();const t=B().tasks.find(x=>x.id===dragTk);if(t&&t.status!==c.dataset.col){t.status=c.dataset.col;save();toast(`Moved to ${STATUSES.find(s=>s[0]===t.status)[1]}`)}dragTk=null;renderBoard()});
$("#cols").addEventListener("click",e=>{const c=e.target.closest(".tk");if(c)openTask(c.dataset.tk)});
$("#cols").addEventListener("keydown",e=>{if(e.key==="Enter"){const c=e.target.closest(".tk");if(c)openTask(c.dataset.tk)}});
function openTask(id){const t=B().tasks.find(x=>x.id===id);if(!t)return;const b=B();
  $("#taskForm").innerHTML=`<h3>Edit task</h3><p class="sub">${t.why?esc(t.why):"Change anything and save."}</p>
   <div class="fld"><label for="tTitle">Title</label><input id="tTitle" value="${esc(t.title)}"></div>
   <div class="fld"><label for="tDesc">Description</label><textarea id="tDesc">${esc(t.desc||"")}</textarea></div>
   <div class="cap" style="grid-template-columns:repeat(2,1fr)">
    <div class="fld" style="margin:0"><label for="tStatus">Status</label><select id="tStatus">${STATUSES.map(([k,l])=>`<option value="${k}"${k===t.status?" selected":""}>${l}</option>`).join("")}</select></div>
    <div class="fld" style="margin:0"><label for="tPts">Story points</label><select id="tPts">${[1,2,3,5,8,13].map(p=>`<option${p===t.points?" selected":""}>${p}</option>`).join("")}</select></div>
    <div class="fld" style="margin:0"><label for="tSkill">Skill</label><select id="tSkill">${BP.SKILLS.map(s=>`<option${s===t.skill?" selected":""}>${s}</option>`).join("")}</select></div>
    <div class="fld" style="margin:0"><label for="tAs">Assignee</label><select id="tAs"><option value="">Unassigned</option>${b.team.map(m=>`<option value="${m.id}"${m.id===t.assignee?" selected":""}>${esc(m.name)} (${t.skill} ${m.skills[t.skill]||0}/5)</option>`).join("")}</select></div>
   </div>
   <div class="fld"><label for="tEpic">Epic</label><select id="tEpic">${b.epics.map(e=>`<option value="${e.id}"${e.id===t.epic?" selected":""}>${esc(e.goal)}</option>`).join("")}</select></div>
   <div class="fld"><label for="tAc">Acceptance criteria (one per line)</label><textarea id="tAc">${esc((t.ac||[]).join("\n"))}</textarea></div>
   <div class="foot"><button class="btn" type="button" id="tDel" style="margin-right:auto;color:var(--red)">🗑 Delete</button><button class="btn" value="cancel">Cancel</button><button class="btn pri" value="save" id="tSave">Save</button></div>`;
  const d=$("#dlgTask");d.returnValue="";d.showModal();
  $("#tDel").onclick=async()=>{d.close();if(await confirmBox("Delete this task?",t.title,"Delete")){B().tasks=B().tasks.filter(x=>x.id!==id);renderBoard();save()}};
  d.addEventListener("close",()=>{if(d.returnValue!=="save")return;t.title=$("#tTitle").value.trim()||t.title;t.desc=$("#tDesc").value;t.status=$("#tStatus").value;t.points=+$("#tPts").value;t.skill=$("#tSkill").value;const a=$("#tAs").value||null;if(a!==t.assignee){t.assignee=a;t.why=a?"Assigned manually.":""}t.epic=$("#tEpic").value||t.epic;t.ac=$("#tAc").value.split("\n").map(s=>s.trim()).filter(Boolean);renderBoard();save()},{once:true});
}
$("#breakBtn").onclick=breakStories;
$("#fromDesignBtn").onclick=fromDesign;
$("#assignBtn").onclick=()=>{const before=B().tasks.filter(t=>!t.assignee).length;BP.assign(B().tasks,B().team,true);renderBoard();save();toast(before?`Assigned ${before} task${before>1?"s":""}`:"Everything is already assigned")};
$("#rebalBtn").onclick=async()=>{if(!await confirmBox("Rebalance all open tasks?","Every task that isn't done gets reassigned by skill and capacity. Manual assignments will change.","Rebalance"))return;B().tasks.forEach(t=>{if(t.status!=="done")t.assignee=null});BP.assign(B().tasks,B().team,true);renderBoard();save();toast("Rebalanced across the team")};
["fAssignee","fEpic","fSkill"].forEach((id,i)=>$("#"+id).addEventListener("change",e=>{filt[["a","e","s"][i]]=e.target.value;renderBoard()}));
$("#addMem").onclick=()=>{B().team.push({id:uid(),name:"New teammate",skills:{Backend:3},capacity:10});renderBoard();save();$$("[data-mname]").at(-1)?.select()};
$("#team").addEventListener("input",e=>{const t=e.target;if(t.dataset.mname){mem(t.dataset.mname).name=t.value;save();renderBoardLite()}if(t.dataset.mcap){mem(t.dataset.mcap).capacity=Math.max(0,+t.value||0);save();renderBoardLite()}});
function renderBoardLite(){const a=document.activeElement,id=a?.dataset?.mname||a?.dataset?.mcap,attr=a?.dataset?.mname?"mname":"mcap",pos=a?.selectionStart;renderBoard();if(id){const el=document.querySelector(`[data-${attr}="${id}"]`);el?.focus();try{if(pos!=null)el.setSelectionRange(pos,pos)}catch(_){}}}
$("#team").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;
  if(t.dataset.sk){const m=mem(t.dataset.sk),s=t.dataset.s;const v=((m.skills[s]||0)+1)%6;if(v)m.skills[s]=v;else delete m.skills[s];renderBoard();save()}
  if(t.dataset.rmmem){const m=mem(t.dataset.rmmem);if(!await confirmBox(`Remove ${m.name}?`,"Their tasks become unassigned.","Remove"))return;B().team=B().team.filter(x=>x.id!==m.id);B().tasks.forEach(x=>{if(x.assignee===m.id)x.assignee=null});renderBoard();save()}});
$("#epics").addEventListener("click",async e=>{const id=e.target.dataset.rmepic;if(!id)return;const ep=B().epics.find(x=>x.id===id);if(!await confirmBox("Delete this epic?",`"${ep.goal}" and its ${B().tasks.filter(t=>t.epic===id).length} tasks will be removed.`,"Delete"))return;B().epics=B().epics.filter(x=>x.id!==id);B().tasks=B().tasks.filter(t=>t.epic!==id);renderBoard();save()});
$("#storyEx").innerHTML=["As a rider, I want to track my driver live on a map so that I know when to go outside","As a shopper, I want to pay with a saved card so that checkout is fast","As an admin, I want a weekly sales dashboard","As a user, I want to get notified when my order ships"].map(s=>`<button class="ex" data-ex="${esc(s)}">${esc(trunc(s.replace(/^As an? \w+, /,""),38))}</button>`).join("");
$("#storyEx").addEventListener("click",e=>{const b=e.target.closest("[data-ex]");if(!b)return;const ta=$("#storyIn");ta.value=(ta.value?ta.value+"\n":"")+b.dataset.ex;ta.focus()});

// ── tabs & mobile panes ──
function showTab(t){const s=t==="studio";$("#studio").hidden=!s;$("#board").hidden=s;$("#tabStudio").setAttribute("aria-selected",s);$("#tabBoard").setAttribute("aria-selected",!s);store.set("bp.tab",t);if(s){requestAnimationFrame(()=>{if(!view.fitted){fit();view.fitted=1}})}else renderBoard()}
$("#tabStudio").onclick=()=>showTab("studio");$("#tabBoard").onclick=()=>showTab("board");
function mobileShow(p){const host=["chat","canvas","spec"].includes(p)?"#studio":"#board",sw=["chat","canvas","spec"].includes(p)?"#sSwitch":"#bSwitch";
  $$(`${host}>[data-pane]`).forEach(x=>x.classList.toggle("on",x.dataset.pane===p));$$(`${sw} button`).forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===p));if(p==="canvas")requestAnimationFrame(fit)}
$("#sSwitch").onclick=e=>{const b=e.target.closest("[data-p]");if(b)mobileShow(b.dataset.p)};
$("#bSwitch").onclick=e=>{const b=e.target.closest("[data-p]");if(b)mobileShow(b.dataset.p)};

// ── library ──
function renderLib(){const list=Object.values(projects).sort((a,b)=>b.updated-a.updated);
  $("#libList").innerHTML=list.map(p=>`<div class="li${p.id===P.id?" cur":""}"><div class="i"><b>${esc(p.name)}</b><span>${p.design.nodes.length} components · ${p.board.tasks.length} tasks · ${new Date(p.updated).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span></div>${p.id===P.id?'<span class="pill">open</span>':`<button class="btn sm" data-open="${p.id}">Open</button>`}<button class="btn sm" data-dup="${p.id}" title="Duplicate">⧉</button><button class="btn sm" data-del="${p.id}" title="Delete" aria-label="Delete ${esc(p.name)}">🗑</button></div>`).join("")}
$("#libBtn").onclick=()=>{renderLib();$("#dlgLib").showModal()};
$("#libClose").onclick=()=>$("#dlgLib").close();
$("#libList").addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.open){$("#dlgLib").close();open(b.dataset.open);toast("Opened "+P.name)}
  if(b.dataset.dup){const c=JSON.parse(JSON.stringify(projects[b.dataset.dup]));c.id=uid();c.name+=" copy";c.updated=Date.now();projects[c.id]=c;save();renderLib()}
  if(b.dataset.del){const p=projects[b.dataset.del];$("#dlgLib").close();if(await confirmBox(`Delete "${p.name}"?`,"This removes it from this browser. Export it first if you want a backup.","Delete")){delete projects[p.id];if(p.id===P.id){const next=Object.values(projects)[0];if(next)open(next.id);else{P=blank();projects[P.id]=P;open(P.id)}}save()}renderLib();$("#dlgLib").showModal()}});
$("#newBtn").onclick=()=>{P=blank();projects[P.id]=P;save();open(P.id);showTab("studio");mobileShow("chat");$("#chatIn").focus();toast("New design. The previous one is in your library.")};

// ── export / import ──
$("#expBtn").onclick=e=>{e.stopPropagation();const m=$("#expMenu");m.hidden=!m.hidden};
document.addEventListener("click",e=>{if(!e.target.closest("#expMenu")&&!e.target.closest("#expBtn"))$("#expMenu").hidden=true;if(!e.target.closest("#palette")&&!e.target.closest("#addBtn"))$("#palette").hidden=true});
const slug=()=>(P.name||"design").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"design";
function download(name,blob){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function svgString(){const N=P.design.nodes;if(!N.length)return null;const pad=40,minX=Math.min(...N.map(n=>n.x))-pad,minY=Math.min(...N.map(n=>n.y))-pad,w=Math.max(...N.map(n=>n.x+W))-minX+pad,h=Math.max(...N.map(n=>n.y+H))-minY+pad;
  const css=`.node rect.box{fill:#fff;stroke:#d6deeb;stroke-width:1.5}.node .nm{font:600 13px 'IBM Plex Sans',Arial,sans-serif;fill:#14213d}.node .tc{font:11px 'IBM Plex Mono',monospace;fill:#8590a8}.edge path{fill:none;stroke:#8a97b3;stroke-width:1.6}.edge.async path{stroke-dasharray:6 4}.edge .hit{display:none}.edge text{font:10.5px 'IBM Plex Mono',monospace;fill:#4b5875}.edge rect{fill:#f6f8fc}`;
  const prevSel=sel,prevSrc=connSrc;sel=null;connSrc=null;renderCanvas();const inner=$("#world").innerHTML;sel=prevSel;connSrc=prevSrc;renderCanvas();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}"><style>${css}</style>${$("#svg defs").outerHTML}<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#f6f8fc"/><text x="${minX+pad}" y="${minY+24}" font-family="Sora,Arial" font-weight="700" font-size="16" fill="#14213d">${esc(P.name)}</text>${inner}</svg>`}
function mdDoc(){const D=P.design,d=D.doc||{fr:[],nfr:[],apis:[],ents:[],trade:[],risks:[]},c=BP.capacity(D.inputs,D.multi),by=Object.fromEntries(D.nodes.map(n=>[n.id,n]));
  const L=[`# ${P.name}`,"",`_Generated with Kiru's Blueprint · ${new Date().toLocaleDateString()}_`,"","## Components","","| Component | Type | Technology | Responsibility |","|---|---|---|---|",...D.nodes.map(n=>`| ${n.name} | ${CATALOG[n.type].l} | ${n.tech} | ${(n.desc||"").replace(/\|/g,"/")}${n.notes?" — "+n.notes.replace(/\|/g,"/"):""} |`),"","## Data flow","",...D.edges.map(e=>`- ${by[e.from]?.name} → ${by[e.to]?.name}${e.label?` (${e.label})`:""}${e.async?" _async_":""}`),"",
    "## Functional requirements","",...d.fr.map(x=>"- "+x),"","## Non-functional requirements","",...d.nfr.map(x=>"- "+x),"","## Capacity estimate","",`- Daily active users: ${fmtN(D.inputs.dau)}; actions/user/day: ${D.inputs.act}; reads per write: ${D.inputs.rw}`,`- Peak: ${fmtN(c.peak)} req/s (avg ${fmtN(c.avg)}); writes ${fmtN(c.wqps)}/s; reads ${fmtN(c.rqps)}/s`,`- Storage: ${fmtBytes(c.storYr)}/year new; ${fmtBytes(c.total)} total over ${D.inputs.years} years incl. replication`,`- App servers: ~${c.servers}; cache: ~${c.cacheGB<1?"<1":c.cacheGB.toFixed(0)} GB`,"",
    "## API","","| Method | Path | Description |","|---|---|---|",...d.apis.map(a=>`| ${a.m} | \`${a.p}\` | ${a.d} |`),"","## Data model","",...d.ents.map(e=>`- **${e.n}**: ${e.f}`),"","## Decisions & trade-offs","",...d.trade.map(x=>"- "+x),"","## Risks & mitigations","",...d.risks.map(x=>"- "+x)];
  const pf=prof();L.push("","## Security & compliance","",...BP.securityControls(pf,D).map(c=>`- **${c.k}:** ${c.v}`));
  if(pf.genai){const m=BP.modelAdvice(pf);L.push("","## Model selection","","| Model | Use for | Why | Watch |","|---|---|---|---|",...m.rows.map(r=>`| ${r.m} | ${r.use} | ${r.why} | ${r.watch} |`),"","**Routing**","",...m.routing.map((x,i)=>`${i+1}. ${x}`),"","**Access & governance**","",...m.access.map(x=>"- "+x),"",`_${m.note}_`);
    BP.genaiPractices(pf).forEach(g=>L.push("",`### ${g.g}`,"",...g.items.map(x=>"- "+x)))}
  const T=BP.testCases(pf,D);L.push("","## Test cases & edge cases","","| ID | Type | Area | Case | Expected |","|---|---|---|---|---|",...T.map(t=>`| ${t.id} | ${t.type} | ${t.area} | ${t.title} | ${t.expect} |`),...(d.customTests||[]).filter(Boolean).map((x,i)=>`| C-${i+1} | Custom | | ${x} | |`));
  L.push("","---","",lldMd().replace(/^# .*\n/,"## Detailed design (per component)\n").replace(/\n## /g,"\n### "));
  if(P.board.tasks.length){L.push("","## Backlog","");P.board.epics.forEach(e=>{L.push(`### ${e.goal}`);P.board.tasks.filter(t=>t.epic===e.id).forEach(t=>L.push(`- [${t.status==="done"?"x":" "}] ${t.title} — ${t.points} pts, ${t.skill}, ${mem(t.assignee)?.name||"unassigned"}`));L.push("")})}
  return L.join("\n")}
$("#expMenu").addEventListener("click",async e=>{const b=e.target.closest("[data-exp]");if(!b)return;$("#expMenu").hidden=true;const k=b.dataset.exp;
  if(k==="json")download(slug()+".blueprint.json",new Blob([JSON.stringify(P,null,2)],{type:"application/json"}));
  if(k==="md")download(slug()+".md",new Blob([mdDoc()],{type:"text/markdown"}));
  if(k==="csv"){if(!P.board.tasks.length){toast("No tasks yet");return}const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';
    const rows=[["Summary","Description","Story Points","Assignee","Status","Epic Name","Labels"],...P.board.tasks.map(t=>[t.title,(t.desc||"")+(t.ac?.length?"\n\nAcceptance criteria:\n- "+t.ac.join("\n- "):""),t.points,mem(t.assignee)?.name||"",STATUSES.find(s=>s[0]===t.status)[1],P.board.epics.find(x=>x.id===t.epic)?.goal||"",t.skill])];
    download(slug()+"-tasks.csv",new Blob([rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}))}
  if(k==="svg"||k==="png"){const s=svgString();if(!s){toast("Nothing to export yet");return}
    if(k==="svg"){download(slug()+".svg",new Blob([s],{type:"image/svg+xml"}));return}
    const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),sc=2;c.width=img.width*sc;c.height=img.height*sc;const x=c.getContext("2d");x.scale(sc,sc);x.drawImage(img,0,0);c.toBlob(bl=>bl?download(slug()+".png",bl):toast("PNG export failed; try SVG"),"image/png")};
    img.onerror=()=>toast("PNG export failed; try SVG");img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s)}
  toast("Downloaded")});
$("#importFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!p.design||!Array.isArray(p.design.nodes))throw 0;p.id=uid();p.updated=Date.now();p.board=p.board||{team:sampleTeam(),epics:[],tasks:[]};p.chat=p.chat||[];projects[p.id]=p;save();open(p.id);showTab("studio");toast("Imported "+p.name)}catch(_){toast("That file isn't a Blueprint project")}};r.readAsText(f);e.target.value="";$("#expMenu").hidden=true});

// ── AI settings ──
function syncMode(){const ai=store.get("bp.ai",{on:"off"});$("#modeTag").textContent=ai.on==="on"&&ai.key?"Claude · your key":"Built-in engine"}
$("#aiBtn").onclick=()=>{const ai=store.get("bp.ai",{on:"off",model:"claude-sonnet-5-5"});$("#aiOn").value=ai.on||"off";$("#aiKey").value=ai.key||"";$("#aiModel").value=ai.model||"claude-sonnet-5-5";const d=$("#dlgAI");d.returnValue="";d.showModal()};
$("#modeTag").onclick=()=>$("#aiBtn").click();
$("#dlgAI").addEventListener("close",()=>{const v=$("#dlgAI").returnValue;
  if(v==="save"){const ai={on:$("#aiOn").value,key:$("#aiKey").value.trim(),model:$("#aiModel").value.trim()||"claude-sonnet-5-5"};if(ai.on==="on"&&!ai.key){ai.on="off";toast("Add a key to turn on AI mode")}store.set("bp.ai",ai);syncMode();if(ai.on==="on")toast("AI mode on")}
  if(v==="clear"){store.set("bp.ai",{on:"off"});syncMode();toast("Key cleared")}});

// ── templates on empty canvas ──
$("#tplChips").innerHTML=[["🚗 Ride-hailing",EXAMPLES[0]],["🔗 URL shortener",EXAMPLES[1]],["✨ RAG chatbot",EXAMPLES[2]],["🛒 E-commerce",EXAMPLES[3]],["💬 Chat app",EXAMPLES[4]],["🍜 Food delivery",EXAMPLES[5]]].map(([l,v])=>`<button class="btn sm" data-tpl="${esc(v)}">${l}</button>`).join("");
$("#tplChips").addEventListener("click",e=>{const b=e.target.closest("[data-tpl]");if(b){send(b.dataset.tpl);mobileShow("chat")}});

// ── boot ──
renderPalette();syncMode();$("#pname").value=P.name;renderChat();renderAll();renderBoard();
showTab(store.get("bp.tab","studio"));requestAnimationFrame(fit);addEventListener("resize",()=>{if(!drag)applyView()});
save();
})();
