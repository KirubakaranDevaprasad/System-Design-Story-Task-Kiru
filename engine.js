/* Kiru's Blueprint: design engine.
   Turns plain-English requests into a system design (nodes, edges, doc) and
   user stories into tasks. Pure functions, no network. */
(function(global){
"use strict";

// ── Component catalog ──
const CATALOG={
  client:{l:"Client app",ic:"📱",tier:0,tech:["React web","Next.js","iOS (Swift)","Android (Kotlin)","React Native","Flutter"],alias:/client|frontend|web app|mobile app|ui\b|browser/},
  cdn:{l:"CDN",ic:"🌐",tier:1,tech:["CloudFront","Cloudflare","Fastly","Akamai"],alias:/\bcdn\b|cloudfront|cloudflare|edge cache/},
  lb:{l:"Load balancer",ic:"⚖️",tier:1,tech:["AWS ALB","NGINX","Envoy","GCP Load Balancer"],alias:/load ?balanc|\balb\b|nginx|haproxy/},
  gateway:{l:"API gateway",ic:"🚪",tier:2,tech:["Kong","AWS API Gateway","Apigee","Envoy"],alias:/api gateway|gateway|kong|apigee/},
  ws:{l:"Realtime gateway",ic:"⚡",tier:2,tech:["WebSockets","Socket.IO","AWS AppSync","SSE"],alias:/websocket|realtime|real-time|socket|live updates|sse\b/},
  auth:{l:"Auth service",ic:"🔐",tier:3,tech:["OAuth2 + JWT","Auth0","Amazon Cognito","Keycloak"],alias:/auth|login|sso|identity|oauth|cognito|keycloak/},
  service:{l:"Service",ic:"🧩",tier:3,tech:["Node.js","Go","Java (Spring)","Python (FastAPI)",".NET"],alias:/service|microservice|api\b|backend/},
  llm:{l:"LLM gateway",ic:"✨",tier:3,tech:["Claude API","Amazon Bedrock","Vertex AI","Self-hosted model"],alias:/\bllm\b|claude|gpt|genai|language model/},
  worker:{l:"Workers",ic:"⚙️",tier:4,tech:["Kubernetes jobs","AWS Lambda","Celery","Sidekiq"],alias:/worker|background job|consumer|lambda/},
  queue:{l:"Message queue",ic:"📨",tier:4,tech:["Amazon SQS","RabbitMQ","Google Pub/Sub","Azure Service Bus"],alias:/queue|sqs|rabbit|pub\/?sub|service bus/},
  stream:{l:"Event stream",ic:"🌊",tier:4,tech:["Apache Kafka","Amazon Kinesis","Redpanda","Pulsar"],alias:/kafka|kinesis|stream|event bus|redpanda|pulsar/},
  scheduler:{l:"Scheduler",ic:"⏰",tier:4,tech:["Temporal","Airflow","EventBridge Scheduler","Cron"],alias:/schedul|cron|airflow|temporal|batch job/},
  notify:{l:"Notifications",ic:"🔔",tier:4,tech:["Firebase FCM + APNs","Amazon SNS","Twilio","SendGrid"],alias:/notif|push|email|sms|twilio|sendgrid/},
  external:{l:"External API",ic:"🔌",tier:4,tech:["Stripe","Google Maps","Twilio","Plaid"],alias:/stripe|third.party|external|maps api|plaid|psp/},
  cache:{l:"Cache",ic:"🧠",tier:5,tech:["Redis","Memcached","Valkey"],alias:/cache|redis|memcache|valkey/},
  sql:{l:"SQL database",ic:"🗄️",tier:5,tech:["PostgreSQL","MySQL","Amazon Aurora","Cloud Spanner"],alias:/postgres|mysql|sql\b|relational|aurora|spanner|database|\bdb\b/},
  nosql:{l:"NoSQL database",ic:"🗃️",tier:5,tech:["Cassandra","DynamoDB","MongoDB","Bigtable"],alias:/nosql|cassandra|dynamo|mongo|bigtable|scylla/},
  search:{l:"Search index",ic:"🔎",tier:5,tech:["Elasticsearch","OpenSearch","Typesense","Algolia"],alias:/search|elastic|opensearch|algolia|typesense/},
  blob:{l:"Object storage",ic:"🪣",tier:5,tech:["Amazon S3","Google Cloud Storage","Azure Blob"],alias:/s3\b|object stor|blob|bucket|file stor|media stor/},
  vector:{l:"Vector DB",ic:"🧭",tier:5,tech:["pgvector","Pinecone","Weaviate","Qdrant"],alias:/vector|embedding|pinecone|weaviate|qdrant/},
  geo:{l:"Geo index",ic:"📍",tier:5,tech:["Redis GEO","PostGIS","H3 + DynamoDB"],alias:/geo|location index|postgis|h3\b/},
  ml:{l:"ML model",ic:"🤖",tier:6,tech:["SageMaker","Vertex AI","PyTorch Serve","Feature store + model"],alias:/\bml\b|machine learning|model|recommend|fraud detect|personaliz|ranking/},
  dwh:{l:"Data warehouse",ic:"🏬",tier:6,tech:["Snowflake","BigQuery","Redshift","Databricks"],alias:/warehouse|snowflake|bigquery|redshift|databricks|analytics|reporting/},
  monitor:{l:"Observability",ic:"📈",tier:6,tech:["Datadog","Prometheus + Grafana","OpenTelemetry","CloudWatch"],alias:/monitor|observab|logging|metrics|datadog|grafana|prometheus|tracing/}
};
const TYPE_ORDER=Object.keys(CATALOG);

// ── Domain library ──
// s: services [name, desc]; f: default features; e: entities; a: APIs; act: actions/user/day; kb: avg write size; rw: reads per write; db: primary store
const DOMAINS=[
 {k:"llm",re:/chatbot|\bllm\b|\brag\b|ai assistant|copilot|genai|gen ai|gpt|claude|ai agent/,n:"AI assistant (RAG)",
  s:[["Chat API","Conversations, streaming responses and history."],["Retrieval service","Embeds the question and fetches relevant chunks."],["Ingestion pipeline","Parses, chunks and embeds documents."],["Guardrails","Input/output checks, PII redaction, rate limits."]],
  f:["llm","vector","blob","queue","cache","monitor"],db:"sql",act:15,kb:4,rw:2,
  e:[["Conversation","id, user_id, title, created_at"],["Message","conversation_id, role, content, tokens, ts"],["Chunk","doc_id, chunk_id, text, embedding"]],
  a:[["POST","/v1/chat","Send a message (streams the reply)"],["POST","/v1/documents","Upload a document for retrieval"],["GET","/v1/conversations/{id}","History"]]},
 {k:"urlshort",re:/url shorten|short ?link|tinyurl|bit\.?ly|link shorten/,n:"URL shortener",
  s:[["Shortener service","Creates unique short codes (base62 of a counter or hash) and stores mappings."],["Redirect service","Resolves a code to its long URL with a 301/302 and records the click."]],
  f:["cache","analytics"],db:"nosql",act:3,kb:.5,rw:100,
  e:[["Link","code (PK), long_url, owner_id, created_at, expires_at"],["Click","code, ts, country, referrer, user_agent"]],
  a:[["POST","/v1/links","Create a short link"],["GET","/{code}","Redirect to the long URL"],["GET","/v1/links/{code}/stats","Click analytics"]]},
 {k:"chat",re:/chat|messag|whatsapp|slack|messenger|discord|dm\b/,n:"Chat & messaging",
  s:[["Chat service","Stores and fans out messages to conversation members."],["Presence service","Tracks who is online and typing."],["Conversation service","Manages groups, members and permissions."]],
  f:["realtime","notify","blob","queue"],db:"nosql",act:40,kb:1,rw:5,
  e:[["Message","conversation_id, message_id (time-ordered), sender_id, body, attachments, sent_at"],["Conversation","id, type (dm/group), title, created_at"],["Member","conversation_id, user_id, role, last_read_id"]],
  a:[["POST","/v1/conversations","Start a DM or group"],["POST","/v1/conversations/{id}/messages","Send a message"],["GET","/v1/conversations/{id}/messages?cursor=","Page through history"],["WS","/v1/realtime","Receive messages, typing and presence"]]},
 {k:"ride",re:/ride|uber|lyft|taxi|\bcab\b|carpool|ola\b/,n:"Ride-hailing",
  s:[["Rider service","Rider profiles, ride requests and history."],["Driver service","Driver profiles, status and location ingestion."],["Matching service","Finds the best nearby driver using the geo index."],["Trip service","Trip lifecycle: requested → accepted → in progress → completed."],["Pricing service","Fares, surge multipliers and estimates."],["Payment service","Charges riders and pays out drivers."]],
  f:["realtime","geo","payment","notify","stream","maps"],db:"sql",act:20,kb:.3,rw:3,
  e:[["Trip","id, rider_id, driver_id, status, pickup, dropoff, fare, started_at, ended_at"],["Driver","id, name, vehicle, rating, status"],["Location","driver_id, lat, lng, heading, ts (hot data in geo index)"],["Payment","id, trip_id, amount, status, provider_ref"]],
  a:[["POST","/v1/rides","Request a ride"],["GET","/v1/rides/{id}","Ride status"],["POST","/v1/drivers/{id}/location","Driver location ping (every 4s)"],["WS","/v1/rides/{id}/track","Live driver position for the rider"]]},
 {k:"food",re:/food deliver|doordash|swiggy|zomato|ubereats|grubhub|restaurant order/,n:"Food delivery",
  s:[["Restaurant service","Restaurants, menus and availability."],["Order service","Cart, checkout and order lifecycle."],["Dispatch service","Assigns couriers based on location and load."],["Tracking service","Live courier location and ETA."],["Payment service","Payments, tips and refunds."]],
  f:["realtime","geo","payment","notify","search","maps"],db:"sql",act:6,kb:1,rw:15,
  e:[["Order","id, user_id, restaurant_id, items, total, status, courier_id"],["Restaurant","id, name, location, cuisine, open_hours"],["MenuItem","id, restaurant_id, name, price, veg"],["Courier","id, status, location"]],
  a:[["GET","/v1/restaurants?near=","Browse nearby restaurants"],["POST","/v1/orders","Place an order"],["GET","/v1/orders/{id}","Order status"],["WS","/v1/orders/{id}/track","Live courier tracking"]]},
 {k:"ecom",re:/e-?commerce|online store|shop|marketplace|amazon|cart|checkout|retail|catalog/,n:"E-commerce",
  s:[["Catalog service","Products, prices and variants."],["Cart service","Shopping carts (hot data in cache)."],["Order service","Checkout and order lifecycle (saga with payment and inventory)."],["Inventory service","Stock reservations and decrements."],["Payment service","Payment intents, captures and refunds."]],
  f:["search","payment","notify","recommend","blob","cache","analytics"],db:"sql",act:25,kb:2,rw:30,
  e:[["Product","id, title, price, category, attributes, images"],["Order","id, user_id, items, total, status, created_at"],["Inventory","sku, warehouse_id, on_hand, reserved"],["Cart","user_id, items, updated_at"]],
  a:[["GET","/v1/products?q=","Search the catalog"],["POST","/v1/cart/items","Add to cart"],["POST","/v1/orders","Checkout"],["GET","/v1/orders/{id}","Order status"]]},
 {k:"video",re:/video|youtube|netflix|twitch|\bott\b|streaming platform|live stream/,n:"Video streaming",
  s:[["Upload service","Resumable uploads to object storage."],["Transcoding pipeline","Converts uploads into adaptive bitrate renditions (HLS/DASH)."],["Playback service","Signed manifests and entitlement checks."],["Metadata service","Titles, descriptions, thumbnails."]],
  f:["blob","cdn","queue","recommend","search","analytics"],db:"nosql",act:8,kb:200,rw:200,
  e:[["Video","id, owner_id, title, status, duration, renditions"],["View","video_id, user_id, position, ts"],["Channel","id, owner_id, name, subscribers"]],
  a:[["POST","/v1/uploads","Start a resumable upload"],["GET","/v1/videos/{id}/manifest","Get playback manifest"],["GET","/v1/feed","Recommended videos"]]},
 {k:"social",re:/social|news ?feed|timeline|twitter|instagram|facebook|tiktok|follow|post/,n:"Social feed",
  s:[["Post service","Creates posts and media references."],["Feed service","Builds home timelines (fan-out on write, pull for celebrities)."],["Graph service","Follow relationships."],["Media service","Image/video upload and processing."]],
  f:["cache","stream","blob","cdn","notify","search","recommend"],db:"nosql",act:60,kb:1,rw:100,
  e:[["Post","id, author_id, text, media, created_at"],["Follow","follower_id, followee_id, created_at"],["Timeline","user_id, post_ids (cached)"]],
  a:[["POST","/v1/posts","Publish a post"],["GET","/v1/feed?cursor=","Home timeline"],["POST","/v1/users/{id}/follow","Follow a user"]]},
 {k:"pay",re:/payment|wallet|fintech|\bbank|ledger|money transfer|upi|remittance/,n:"Payments",
  s:[["Payments API","Idempotent payment requests and status."],["Ledger service","Double-entry ledger, the source of truth for balances."],["Fraud service","Real-time risk scoring before authorisation."],["Reconciliation worker","Matches internal ledger against provider settlements nightly."]],
  f:["payment","stream","fraud","notify","audit","scheduler"],db:"sql",act:4,kb:1,rw:2,strong:true,
  e:[["Payment","id, idempotency_key, amount, currency, status, provider_ref"],["LedgerEntry","id, account_id, debit, credit, txn_id, ts"],["Account","id, owner_id, currency, balance (derived)"]],
  a:[["POST","/v1/payments","Create a payment (Idempotency-Key header)"],["GET","/v1/payments/{id}","Payment status"],["POST","/v1/transfers","Move money between accounts"]]},
 {k:"booking",re:/booking|hotel|airbnb|reservation|ticketing|flight booking|event ticket|appointment/,n:"Booking & reservations",
  s:[["Listing service","Properties, rooms or events and their details."],["Search service","Availability search by place and date."],["Booking service","Holds and confirms reservations without double-booking."],["Payment service","Deposits, charges and refunds."],["Review service","Ratings and reviews."]],
  f:["search","payment","notify","cache","blob"],db:"sql",act:10,kb:1,rw:50,strong:true,
  e:[["Listing","id, host_id, title, location, price, capacity"],["Booking","id, listing_id, guest_id, check_in, check_out, status"],["Availability","listing_id, date, available"]],
  a:[["GET","/v1/search?where=&dates=","Search availability"],["POST","/v1/bookings","Hold and book"],["POST","/v1/bookings/{id}/cancel","Cancel"]]},
 {k:"notify",re:/notification (system|service|platform)|push notification|alerting system/,n:"Notification platform",
  s:[["Notification API","Accepts send requests from other services."],["Template service","Templates and localisation."],["Preference service","User opt-ins, quiet hours and channels."],["Dispatchers","Per-channel senders with retries."]],
  f:["queue","notify","scheduler","analytics"],db:"nosql",act:5,kb:1,rw:3,
  e:[["Notification","id, user_id, channel, template_id, status, sent_at"],["Preference","user_id, channel, enabled, quiet_hours"]],
  a:[["POST","/v1/notifications","Send or schedule a notification"],["PUT","/v1/users/{id}/preferences","Update preferences"]]},
 {k:"ratelimit",re:/rate limit/,n:"Rate limiter",
  s:[["Rate limiter","Token bucket / sliding window checks at the gateway."],["Rules service","Per-client limits and overrides."]],
  f:["cache"],db:"sql",act:200,kb:.1,rw:1,
  e:[["Rule","client_id, route, limit, window"],["Counter","key, tokens, refreshed_at (in Redis)"]],
  a:[["GET","/v1/rules","List rules"],["PUT","/v1/rules/{id}","Update a rule"]]},
 {k:"files",re:/file (storage|sharing|sync)|dropbox|google drive|onedrive|document storage/,n:"File storage & sync",
  s:[["Metadata service","Folders, files, versions and permissions."],["Upload service","Chunked, resumable, deduplicated uploads."],["Sync service","Pushes changes to devices."],["Sharing service","Links and access control."]],
  f:["blob","cdn","queue","notify","realtime"],db:"sql",act:15,kb:500,rw:4,
  e:[["File","id, owner_id, path, size, latest_version"],["Version","file_id, version, chunk_hashes, created_at"],["Share","file_id, grantee, role"]],
  a:[["POST","/v1/files/upload","Start chunked upload"],["GET","/v1/files/{id}","Download / metadata"],["GET","/v1/changes?cursor=","Sync changes"]]},
 {k:"crm",re:/\bcrm\b|hubspot|salesforce|lead|sales pipeline|contacts management|marketing automation/,n:"CRM",
  s:[["Contacts service","Contacts, companies and properties."],["Deals service","Pipelines, stages and forecasts."],["Activity service","Emails, calls, meetings timeline."],["Campaign service","Email campaigns and sequences."],["Reporting service","Dashboards over the warehouse."]],
  f:["search","queue","notify","analytics","scheduler"],db:"sql",act:30,kb:2,rw:10,
  e:[["Contact","id, email, name, company_id, owner_id, properties"],["Deal","id, pipeline, stage, amount, close_date, owner_id"],["Activity","id, contact_id, type, body, ts"]],
  a:[["GET","/v1/contacts?q=","Search contacts"],["POST","/v1/deals","Create a deal"],["PATCH","/v1/deals/{id}","Move stage"],["POST","/v1/campaigns/{id}/send","Send a campaign"]]},
 {k:"analytics",re:/analytics platform|clickstream|telemetry|logging (system|platform)|metrics platform|event tracking|observability platform/,n:"Analytics pipeline",
  s:[["Ingestion API","Accepts batched events at high throughput."],["Stream processor","Validates, enriches and aggregates in real time."],["Query service","Serves dashboards from aggregates."]],
  f:["stream","analytics","blob","cache"],db:"nosql",act:200,kb:.5,rw:.2,
  e:[["Event","event_id, user_id, name, props, ts"],["Aggregate","metric, dimension, window, value"]],
  a:[["POST","/v1/events","Ingest a batch of events"],["GET","/v1/metrics?name=&range=","Query a metric"]]},
 {k:"iot",re:/\biot\b|sensor|smart home|device fleet|telemetry from devices/,n:"IoT platform",
  s:[["Device gateway","MQTT connections and auth for devices."],["Telemetry processor","Stream processing and alert rules."],["Device registry","Provisioning, shadows and firmware."]],
  f:["stream","notify","analytics"],db:"nosql",act:2000,kb:.2,rw:.1,
  e:[["Device","id, owner_id, model, firmware, last_seen"],["Reading","device_id, metric, value, ts"]],
  a:[["MQTT","devices/{id}/telemetry","Publish readings"],["GET","/v1/devices/{id}/readings","Query readings"]]}
];

// feature → components it brings
const FEATURES={
  realtime:{re:/real.?time|live|tracking|track |instant|websocket/,why:"Live updates over persistent connections"},
  geo:{re:/location|nearby|geo|map|gps|distance/,why:"Fast nearby lookups"},
  payment:{re:/pay|checkout|billing|subscription|charge/,why:"Charging customers via a payment provider"},
  notify:{re:/notif|push|email|sms|alert/,why:"Push, email and SMS"},
  blob:{re:/upload|image|photo|video|file|media|attachment|document/,why:"Large files live in object storage"},
  search:{re:/search|discover|filter|query/,why:"Full-text and faceted search"},
  recommend:{re:/recommend|personaliz|for you|suggest/,why:"Personalised ranking"},
  analytics:{re:/analytic|dashboard|report|insight|metric|kpi/,why:"Events flow to the warehouse for reporting"},
  cache:{re:/fast|low latency|cache|read.heavy|millisecond/,why:"Hot reads from memory"},
  queue:{re:/async|background|queue|retry|batch/,why:"Async work with retries"},
  stream:{re:/event|stream|kafka|audit trail/,why:"Event backbone"},
  scheduler:{re:/schedul|cron|daily job|nightly|reminder/,why:"Timed jobs"},
  llm:{re:/\bai\b|llm|gpt|claude|genai|summar|chatbot/,why:"Generative AI features"},
  vector:{re:/semantic|embedding|rag|similar/,why:"Semantic retrieval"},
  fraud:{re:/fraud|risk|anomal/,why:"Risk scoring"},
  audit:{re:/audit|complian|regulat|gdpr|hipaa|pci/,why:"Compliance and audit trail"},
  maps:{re:/maps?|route|eta|direction/,why:"Routing and ETAs from a maps provider"},
  multiregion:{re:/multi.?region|global|worldwide|geo.?distributed|across (countries|regions)/,why:"Serve users from the nearest region"}
};

const uid=()=>Math.random().toString(36).slice(2,9);
const fmtN=n=>n>=1e9?(n/1e9).toFixed(n>=1e10?0:1)+"B":n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+"M":n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+"K":String(Math.round(n));
const fmtBytes=b=>b>=1e15?(b/1e15).toFixed(1)+" PB":b>=1e12?(b/1e12).toFixed(1)+" TB":b>=1e9?(b/1e9).toFixed(1)+" GB":b>=1e6?(b/1e6).toFixed(1)+" MB":(b/1e3).toFixed(1)+" KB";

function parseScale(t){
  const m=t.match(/(\d+(?:\.\d+)?)\s*(k|m|b|thousand|million|billion|mn|bn|lakh|crore)?\+?\s*(daily active users|daily users|dau|monthly active users|mau|users|customers|requests per second|rps|qps|concurrent( users)?|drivers|riders|devices|orders a day|orders per day|messages a day|messages per day)/i);
  if(!m)return null;
  const mul={k:1e3,thousand:1e3,m:1e6,mn:1e6,million:1e6,b:1e9,bn:1e9,billion:1e9,lakh:1e5,crore:1e7}[(m[2]||"").toLowerCase()]||1;
  const v=parseFloat(m[1])*mul,unit=m[3].toLowerCase();
  if(/rps|qps|requests per second/.test(unit))return {qps:v};
  if(/mau|monthly/.test(unit))return {dau:v*.35};
  if(/concurrent/.test(unit))return {dau:v*8};
  return {dau:v};
}
function detectDomain(t){return DOMAINS.find(d=>d.re.test(t))||null}
function detectFeatures(t){return Object.entries(FEATURES).filter(([,f])=>f.re.test(t)).map(([k])=>k)}
function detectTech(t){
  const out={};
  for(const [type,c] of Object.entries(CATALOG)){for(const tech of c.tech){const key=tech.toLowerCase().split(/[ (+]/)[0];if(key.length>2&&new RegExp("\\b"+key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(t)){out[type]=tech}}}
  const cloud=/\baws\b|amazon web/i.test(t)?"aws":/\bgcp\b|google cloud/i.test(t)?"gcp":/azure/i.test(t)?"azure":null;
  return {pick:out,cloud};
}
const CLOUD_PICK={aws:{cdn:"CloudFront",lb:"AWS ALB",gateway:"AWS API Gateway",queue:"Amazon SQS",stream:"Amazon Kinesis",nosql:"DynamoDB",sql:"Amazon Aurora",blob:"Amazon S3",dwh:"Redshift",ml:"SageMaker",notify:"Amazon SNS",monitor:"CloudWatch",auth:"Amazon Cognito",llm:"Amazon Bedrock",worker:"AWS Lambda"},
  gcp:{lb:"GCP Load Balancer",queue:"Google Pub/Sub",nosql:"Bigtable",sql:"Cloud Spanner",blob:"Google Cloud Storage",dwh:"BigQuery",ml:"Vertex AI",llm:"Vertex AI"},
  azure:{queue:"Azure Service Bus",blob:"Azure Blob"}};

function titleCase(s){return s.replace(/\b\w/g,c=>c.toUpperCase())}
function guessName(text,dom){
  if(dom)return dom.n;
  const m=text.match(/(?:design|build|create|make|architect)\s+(?:an?|the|me an?)?\s*(.{3,40}?)(?:\s+(?:for|that|which|with|where|to)\b|[.,!?]|$)/i);
  return m?titleCase(m[1].replace(/\b(system|app|application|platform)\b/i,"$1")):"New system";
}

// ── Build a design from a spec ──
function buildDesign(text,opts={}){
  const t=text.toLowerCase();
  const dom=detectDomain(t);
  const feats=new Set([...(dom?dom.f:["cache"]),...detectFeatures(t)]);
  const tech=detectTech(t);
  const scale=parseScale(text)||{};
  const nodes=[],edges=[];
  const add=(type,name,desc,techOverride)=>{const c=CATALOG[type];const n={id:uid(),type,name:name||c.l,tech:techOverride||tech.pick[type]||(tech.cloud&&CLOUD_PICK[tech.cloud]?.[type])||c.tech[0],desc:desc||"",notes:""};nodes.push(n);return n};
  const link=(a,b,label,async)=>{if(a&&b&&a!==b&&!edges.some(e=>e.from===a.id&&e.to===b.id))edges.push({id:uid(),from:a.id,to:b.id,label:label||"",async:!!async})};

  const client=add("client",/mobile|ios|android|app\b/.test(t)?"Mobile & web apps":"Web app","Users interact through the web or mobile app.",/mobile|ios|android|app\b/.test(t)?"React Native":undefined);
  const needCdn=feats.has("blob")||feats.has("cdn")||/web|static|global/.test(t);
  const cdn=needCdn?add("cdn","CDN","Caches static assets and media close to users."):null;
  const lb=add("lb","Load balancer","Spreads traffic across gateway instances; health checks and TLS termination.");
  const gw=add("gateway","API gateway","Routing, auth checks, rate limiting and request validation.");
  const ws=feats.has("realtime")?add("ws","Realtime gateway","Holds persistent connections and pushes live updates."):null;
  const auth=/user|login|account|customer|rider|driver|member|sign/.test(t)||dom?add("auth","Auth service","Sign-up, login and token issuance (JWT, refresh tokens)."):null;
  if(cdn)link(client,cdn,"static & media");
  link(client,lb,"HTTPS");link(lb,gw,"");if(ws)link(client,ws,"WebSocket");
  if(auth)link(gw,auth,"verify token");

  const services=(dom?dom.s:[[guessName(text,null).replace(/ system$/i,"")+" service","Core business logic and APIs."]]).map(([n,d])=>add("service",n,d));
  services.forEach(s=>link(gw,s,"REST/gRPC"));

  const strong=dom?.strong||/consisten|acid|transaction|money|financial/.test(t);
  const writeHeavy=/write.heavy|high write|ingest|telemetry|log/.test(t);
  let primaryType=tech.pick.sql?"sql":tech.pick.nosql?"nosql":strong?"sql":writeHeavy?"nosql":(dom?.db||"sql");
  const db=add(primaryType,primaryType==="sql"?"Primary database":"Primary datastore",primaryType==="sql"?"Source of truth with transactions; read replicas for scale.":"Partitioned for high write throughput and horizontal scale.",primaryType==="nosql"&&writeHeavy&&!tech.pick.nosql?"Cassandra":undefined);
  services.forEach(s=>link(s,db,"read/write"));
  let cache=null;
  if(feats.has("cache")||(dom&&dom.rw>=10)){cache=add("cache","Cache","Hot reads, sessions and counters; cache-aside with TTLs.");services.slice(0,4).forEach(s=>link(s,cache,"cache-aside"))}

  let queue=null,stream=null,worker=null;
  if(feats.has("queue")||feats.has("notify")||feats.has("blob")&&dom?.k==="video"){queue=add("queue","Message queue","Decouples slow work; retries with backoff and a dead-letter queue.");}
  if(feats.has("stream")||feats.has("analytics")||feats.has("fraud")){stream=add("stream","Event stream","Domain events (created, updated, completed) for consumers to react to.");services.forEach(s=>link(s,stream,"publish events",true))}
  if(queue){worker=add("worker",dom?.k==="video"?"Transcoding workers":"Background workers","Consume jobs from the queue and process them idempotently.");services.slice(0,2).forEach(s=>link(s,queue,"enqueue",true));link(queue,worker,"consume",true);link(worker,db,"update status")}
  if(ws){const rt=services.find(s=>/chat|track|trip|presence|sync|order/i.test(s.name))||services[0];link(rt,ws,"push updates",true)}
  if(feats.has("geo")){const g=add("geo","Geo index","Driver/courier positions bucketed by geohash for nearby queries.");const m=services.find(s=>/match|dispatch|driver|track/i.test(s.name))||services[0];link(m,g,"nearby query")}
  if(feats.has("payment")){let p=services.find(s=>/pay/i.test(s.name));if(!p){p=add("service","Payment service","Payment intents, captures, refunds; idempotency keys.");link(gw,p,"REST")}const x=add("external","Payment provider","Card processing and payouts.",tech.pick.external||"Stripe");link(p,x,"API",false)}
  if(feats.has("maps")){const x=add("external","Maps & routing API","Geocoding, routes and ETAs.","Google Maps");const m=services.find(s=>/pric|track|dispatch|match/i.test(s.name))||services[0];link(m,x,"ETA/route")}
  if(feats.has("notify")){const n=add("notify","Notifications","Push, email and SMS delivery with user preferences.");link(worker||queue||services[0],n,"send",true)}
  if(feats.has("blob")){const b=add("blob","Object storage","Uploads, media and documents; served through the CDN.");const up=services.find(s=>/upload|media|metadata|chat|catalog|file/i.test(s.name))||services[0];link(up,b,"signed URLs");if(worker)link(worker,b,"process");if(cdn)link(cdn,b,"origin")}
  if(feats.has("search")){const s=add("search","Search index","Denormalised documents for full-text and faceted search.");const src=services.find(x=>/catalog|search|listing|contact|metadata|restaurant/i.test(x.name))||services[0];link(src,s,"query");if(stream)link(stream,s,"index updates",true)}
  if(feats.has("recommend")){const m=add("ml","Recommendation model","Ranks items per user from behaviour signals.");const f=services.find(x=>/feed|catalog|playback|recommend/i.test(x.name))||services[0];link(f,m,"score");if(stream)link(stream,m,"training data",true)}
  if(feats.has("fraud")){const m=add("ml","Fraud model","Scores each transaction in under 100 ms.");const f=services.find(x=>/fraud|payment/i.test(x.name))||services[0];link(f,m,"risk score")}
  if(feats.has("llm")||dom?.k==="llm"){const l=add("llm","LLM gateway","Model calls with retries, caching, token budgets and fallbacks.",tech.pick.llm||"Claude API");const f=services[0];link(f,l,"prompt");if(feats.has("vector")||dom?.k==="llm"){const v=add("vector","Vector DB","Embeddings for semantic retrieval.");link(services.find(x=>/retriev/i.test(x.name))||f,v,"similarity search");if(worker)link(worker,v,"upsert embeddings")}}
  if(feats.has("scheduler")){const s=add("scheduler","Scheduler","Timed and recurring jobs (reminders, reconciliation, reports).");link(s,queue||services[0],"trigger",true)}
  if(feats.has("analytics")){const w=add("dwh","Data warehouse","Historical analytics and dashboards.");link(stream||db,w,"ETL / CDC",true)}
  if(feats.has("audit")){const a=add("nosql","Audit log","Append-only, immutable record of sensitive actions.","DynamoDB");link(stream||services[0],a,"append",true)}
  const mon=add("monitor","Observability","Metrics, logs and traces with SLO alerts.");link(gw,mon,"telemetry",true);

  const scaleIn={dau:scale.dau||(scale.qps?scale.qps*86400/((dom?.act||20)):1e6),act:dom?.act||20,kb:dom?.kb||1,rw:dom?.rw||10,years:5};
  const multi=feats.has("multiregion");
  const doc=buildDoc(text,dom,feats,scaleIn,primaryType,strong,multi);
  return {name:guessName(text,dom),domain:dom?.k||"custom",nodes,edges,doc,inputs:scaleIn,multi,feats:[...feats],source:text};
}

function buildDoc(text,dom,feats,inp,primaryType,strong,multi){
  const fr=[];
  if(dom){dom.a.forEach(([m,p,d])=>fr.push(d))}else fr.push("Users can sign up, log in and manage their profile","Core create / read / update flows for the main entity");
  if(feats.has("search"))fr.push("Users can search and filter results");
  if(feats.has("notify"))fr.push("Users get notified about important events");
  if(feats.has("realtime"))fr.push("Changes appear live without refreshing");
  if(feats.has("payment"))fr.push("Users can pay securely and get receipts");
  if(feats.has("recommend"))fr.push("Users see personalised recommendations");
  const nfr=[`Availability: 99.9%+ for core flows${multi?" across regions":""}`,`Latency: p99 < ${feats.has("realtime")?"200":"300"} ms for reads`,strong?"Consistency: strong for money and inventory; no double-spend or double-booking":"Consistency: eventual is fine for feeds and counters",`Scale: ${fmtN(inp.dau)} daily active users at launch, 10× headroom`,"Security: TLS everywhere, encryption at rest, least-privilege access"];
  if(feats.has("audit"))nfr.push("Compliance: immutable audit trail, data retention policies");
  if(multi)nfr.push("Data residency: keep user data in their home region where required");
  const apis=dom?dom.a.map(([m,p,d])=>({m,p,d})):[{m:"POST",p:"/v1/items",d:"Create"},{m:"GET",p:"/v1/items/{id}",d:"Read"},{m:"GET",p:"/v1/items?cursor=",d:"List"}];
  const ents=dom?dom.e.map(([n,f])=>({n,f})):[{n:"User",f:"id, email, name, created_at"},{n:"Item",f:"id, owner_id, data, created_at, updated_at"}];
  const trade=[];
  trade.push(primaryType==="sql"?`${strong?"Chose a relational database for ACID transactions":"Relational database keeps joins and transactions simple"}; scale reads with replicas and partition later by tenant or region.`:"Chose a partitioned NoSQL store for write throughput and horizontal scale; model tables around query patterns and accept eventual consistency.");
  if(inp.rw>=10)trade.push(`Read-heavy (~${inp.rw}:1), so cache-aside in Redis takes most reads off the database. Risk: stale data, mitigated with short TTLs and invalidation on write.`);
  if(feats.has("realtime"))trade.push("WebSockets for live updates; connection servers are stateful, so use sticky routing plus a pub/sub layer to fan out across nodes.");
  if(feats.has("stream"))trade.push("Event stream decouples services and feeds search, analytics and ML. Costs: eventual consistency and the need for idempotent consumers.");
  if(feats.has("payment"))trade.push("Payments use idempotency keys and a saga (reserve → charge → confirm, with compensation) instead of distributed transactions.");
  if(dom?.k==="social")trade.push("Hybrid fan-out: push posts to followers' timelines on write, but pull for accounts with millions of followers.");
  if(dom?.k==="urlshort")trade.push("Short codes from a distributed counter (base62) avoid collisions; hashing is simpler but needs collision checks.");
  if(multi)trade.push("Active-active across regions with geo-DNS; conflict resolution needed for cross-region writes (or route writes to a home region).");
  const risks=["Hot partitions or keys under peak load: shard by a high-cardinality key and cache hot items","Cascading failures between services: timeouts, retries with jitter, circuit breakers","Single region outage: backups, cross-region replicas and a tested failover runbook"];
  if(feats.has("realtime"))risks.push("Connection storms after a deploy: drain gradually and reconnect with backoff");
  if(feats.has("llm"))risks.push("LLM latency and cost spikes: stream responses, cache answers, set token budgets and fallbacks");
  return {fr,nfr,apis,ents,trade,risks,summary:dom?`A ${dom.n.toLowerCase()} system`:"A custom system"};
}

// ── Capacity math ──
function capacity(inp,multi){
  const reqDay=inp.dau*inp.act;
  const avg=reqDay/86400,peak=avg*3;
  const writes=reqDay/(inp.rw+1),reads=reqDay-writes;
  const storYr=writes*inp.kb*1024*365;
  const total=storYr*inp.years*(multi?2:1)*3; // ×3 replication
  const bw=peak*inp.kb*1024;
  const servers=Math.max(2,Math.ceil(peak/800)*(multi?2:1));
  const cacheGB=reads*.2*inp.kb*1024/1e9;
  return {reqDay,avg,peak,wqps:writes/86400,rqps:reads/86400,storYr,total,bw,servers,cacheGB};
}

// ── Layout ──
function layout(design){
  const cols={};design.nodes.forEach(n=>{const tier=CATALOG[n.type]?.tier??3;(cols[tier]=cols[tier]||[]).push(n)});
  const max=Math.max(...Object.values(cols).map(c=>c.length));
  Object.entries(cols).forEach(([tier,list])=>{const off=(max-list.length)*48;list.forEach((n,i)=>{n.x=40+tier*240;n.y=40+off+i*96})});
  return design;
}

// ── Chat command parsing for edits ──
function findType(phrase){
  const p=phrase.toLowerCase();
  for(const k of ["guard","rerank","eval","kms","waf","llm","vector","geo","ws","cdn","lb","gateway","cache","queue","stream","scheduler","notify","search","blob","dwh","monitor","ml","auth","external","nosql","sql","worker","client"]){if(CATALOG[k]&&CATALOG[k].alias.test(p))return k}
  return null;
}
function findTech(phrase){
  const p=phrase.toLowerCase();
  for(const [type,c] of Object.entries(CATALOG))for(const tech of c.tech){const key=tech.toLowerCase().split(/[ (+]/)[0];if(key.length>2&&p.includes(key))return {type,tech}}
  return null;
}

// ── Stories → tasks ──
const SKILLS=["Frontend","Backend","Mobile","Data","DevOps","QA","ML"];
const HARD=/real.?time|payment|security|auth|encrypt|migrat|scale|concurren|ml\b|model|fraud|search|distributed|offline|sync|compliance/i;
function parseStories(text){
  return text.split(/\n+|(?=\bAs an? )/i).map(s=>s.trim()).filter(s=>s.length>8).map(s=>{
    const m=s.match(/as an? (.+?),? i (?:want|need|would like) (?:to )?(.+?)(?:,? so (?:that )?(.+))?[.]?$/i);
    return {raw:s,role:m?m[1]:"user",goal:m?m[2]:s.replace(/^(i want|we need|need|add|build)\s+(to\s+)?/i,""),why:m?m[3]||"":""};
  });
}
function storyPoints(base,text){let p=base;if(HARD.test(text))p+=1;if(/\b(and|also|plus|multiple|all)\b/i.test(text))p+=1;const fib=[1,2,3,5,8,13];return fib.find(f=>f>=p)||13}
function breakDown(story,design,mobile){
  const g=story.goal.replace(/[.]$/,""),G=g.charAt(0).toUpperCase()+g.slice(1);
  const nodes=design?.nodes||[];
  const STOP=/^(with|that|this|the|and|for|from|into|saved|want|need|able|have|their|your|my|our|see|get|use|new|all)$/;
  const gw=g.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=3&&!STOP.test(w));
  const SYN={checkout:"order",cart:"cart",card:"payment",refund:"payment",track:"tracking",dashboard:"reporting",report:"reporting",message:"chat",search:"search",find:"search",book:"booking",login:"auth",driver:"driver",ride:"trip",upload:"upload",feed:"feed",post:"post"};
  const scoreSvc=n=>n.name.toLowerCase().replace(/service|pipeline|workers?/g,"").split(/\s+/).filter(Boolean).reduce((a,sw)=>a+gw.filter(w=>sw.startsWith(w)||w.startsWith(sw.slice(0,5))||SYN[w]===sw).length,0);
  const touched=nodes.filter(n=>n.type==="service").map(n=>[n,scoreSvc(n)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const svc=touched[0]?.name||(nodes.find(n=>n.type==="service")?.name)||"backend";
  const tasks=[];
  const T=(title,skill,base,desc,ac)=>tasks.push({id:uid(),title,skill,points:storyPoints(base,g),desc,ac:ac||[],status:"todo",assignee:null,why:""});
  T(`Design API contract for "${g}"`,"Backend",1,`Define request/response, errors and auth for ${svc}.`,["OpenAPI spec reviewed","Error codes documented"]);
  T(`Implement ${svc} endpoint for "${g}"`,"Backend",3,`Business logic, validation and persistence in ${svc}.`,["Happy path works end to end","Input validation and error handling","Idempotent where it changes data"]);
  T(`Data model & migration for "${g}"`,"Data",2,"Schema changes, indexes and a backfill if needed.",["Migration is reversible","Indexes cover the new queries"]);
  T(`${mobile?"Mobile":"Web"} UI for "${g}"`,mobile?"Mobile":"Frontend",3,`Screens, states (loading, empty, error) and accessibility for the ${story.role}.`,["Matches design","Loading, empty and error states","Accessible (labels, focus, contrast)"]);
  const lc=g.toLowerCase();const has=t=>nodes.some(n=>n.type===t);
  if(/real.?time|live|track|instant/.test(lc)||has("ws")&&/track|status|message|chat/.test(lc))T(`Realtime updates for "${g}"`,"Backend",3,"Publish events and push them over the realtime gateway.",["Updates arrive in under 1 s","Reconnects resume without losing events"]);
  if(/pay|checkout|refund|charge|bill/.test(lc))T(`Payment integration for "${g}"`,"Backend",5,"Payment intent, webhook handling and idempotency keys.",["Duplicate requests don't double-charge","Webhook retries handled","Refund path tested"]);
  if(/search|find|filter|browse/.test(lc))T(`Search indexing & query for "${g}"`,"Data",3,"Index documents and expose a filtered query.",["Results in under 200 ms","Index stays in sync with writes"]);
  if(/notif|alert|remind|email|sms|push/.test(lc))T(`Notifications for "${g}"`,"Backend",2,"Templates, preferences and the send trigger.",["Respects user preferences","Retries on failure"]);
  if(/upload|photo|image|video|file|attach/.test(lc))T(`Upload pipeline for "${g}"`,"Backend",3,"Signed upload URLs, validation and processing.",["Large files resume","Unsafe files rejected"]);
  if(/recommend|personal|rank|suggest|predict|ai\b|smart/.test(lc))T(`Model & scoring for "${g}"`,"ML",5,"Features, model choice, offline eval and serving.",["Offline metric beats baseline","p99 scoring latency under 100 ms"]);
  if(/report|dashboard|analytic|insight/.test(lc))T(`Analytics events & dashboard for "${g}"`,"Data",3,"Emit events and build the dashboard.",["Events land in the warehouse","Dashboard reviewed with stakeholders"]);
  if(/login|sign|auth|permission|role|secure/.test(lc))T(`Auth & permissions for "${g}"`,"Backend",3,"Scopes, role checks and audit logging.",["Unauthorised access returns 403","Sensitive actions are audited"]);
  T(`Tests for "${g}"`,"QA",2,"Unit, integration and an end-to-end happy path; edge cases from acceptance criteria.",["Coverage on new code","E2E test in CI"]);
  T(`Deploy & monitor "${g}"`,"DevOps",1,"Feature flag, dashboards and alerts; rollout plan.",["Behind a feature flag","Alert on error rate and latency"]);
  return tasks;
}
function backlogFromDesign(design,mobile){
  const out=[];
  design.nodes.forEach(n=>{
    if(n.type==="service"){out.push({goal:`deliver ${n.name}`,role:"team",tasks:[
      {title:`Scaffold ${n.name} (${n.tech})`,skill:"Backend",points:2,desc:n.desc},
      {title:`Implement core APIs in ${n.name}`,skill:"Backend",points:5,desc:"Endpoints from the design doc."},
      {title:`Tests & contract checks for ${n.name}`,skill:"QA",points:3,desc:"Unit, integration and consumer contract tests."},
      {title:`CI/CD, dashboards & alerts for ${n.name}`,skill:"DevOps",points:2,desc:"Pipeline, SLOs and alerts."}]})}
  });
  const infra=design.nodes.filter(n=>["sql","nosql","cache","queue","stream","search","blob","vector","geo","dwh","cdn","lb","gateway","ws","auth","notify","scheduler","worker","llm","ml","external","monitor"].includes(n.type));
  if(infra.length)out.push({goal:"stand up the platform",role:"team",tasks:infra.map(n=>({title:`Provision ${n.name} (${n.tech})`,skill:["sql","nosql","search","vector","geo","dwh"].includes(n.type)?"Data":n.type==="ml"?"ML":["external","auth","notify","llm","worker"].includes(n.type)?"Backend":"DevOps",points:["stream","search","ml","llm","ws","geo"].includes(n.type)?5:["sql","nosql","auth","external"].includes(n.type)?3:2,desc:n.desc}))});
  const client=design.nodes.find(n=>n.type==="client");
  if(client)out.push({goal:`build the ${client.name}`,role:"user",tasks:[{title:"App shell, navigation & design system",skill:mobile?"Mobile":"Frontend",points:5,desc:""},{title:"Auth screens (sign up, login, reset)",skill:mobile?"Mobile":"Frontend",points:3,desc:""},{title:"Core screens wired to APIs",skill:mobile?"Mobile":"Frontend",points:8,desc:""}]});
  return out.map(e=>({...e,tasks:e.tasks.map(t=>({id:uid(),status:"todo",assignee:null,ac:[],why:"",...t}))}));
}
// Greedy assignment: highest-point tasks first; best skill match with remaining capacity.
function assign(tasks,team,onlyUnassigned){
  const load=Object.fromEntries(team.map(m=>[m.id,0]));
  tasks.forEach(t=>{if(t.assignee&&load[t.assignee]!=null&&(onlyUnassigned||t.status==="done"))load[t.assignee]+=t.status==="done"?0:t.points});
  const todo=tasks.filter(t=>t.status!=="done"&&(!onlyUnassigned||!t.assignee)).sort((a,b)=>b.points-a.points);
  todo.forEach(t=>{
    let best=null,bs=-1e9;
    team.forEach(m=>{const lvl=m.skills[t.skill]||0;if(!lvl)return;const free=m.capacity-load[m.id];const need=t.points>=8?4:t.points>=5?3:1;
      const s=lvl*10-(load[m.id]/Math.max(1,m.capacity))*25+(lvl>=need?8:-12)+(free>=t.points?6:-30);if(s>bs){bs=s;best=m}});
    if(!best){team.forEach(m=>{const lvl=Math.max(...Object.values(m.skills));const s=lvl*3-(load[m.id]/Math.max(1,m.capacity))*25;if(s>bs){bs=s;best=m}});t.why=best?`No one lists ${t.skill}; ${best.name} has the most headroom.`:""}
    else{const lvl=best.skills[t.skill];t.why=`${best.name}: ${t.skill} ${lvl}/5, ${load[best.id]}/${best.capacity} pts before this.`}
    if(best){t.assignee=best.id;load[best.id]+=t.points}
  });
  return load;
}

global.BP={CATALOG,TYPE_ORDER,DOMAINS,FEATURES,SKILLS,uid,fmtN,fmtBytes,parseScale,detectDomain,detectFeatures,buildDesign,buildDoc,capacity,layout,findType,findTech,parseStories,breakDown,backlogFromDesign,assign,storyPoints};
})(window);
