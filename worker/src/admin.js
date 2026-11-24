// Aggregate-only operational telemetry. No food, health data, tokens or push endpoints are recorded.
const day=()=>new Date().toISOString().slice(0,10);
export function instrument(env){return {...env, adminCounters:new Map()}}
export function bump(env,key){if(env.adminCounters)env.adminCounters.set(key,(env.adminCounters.get(key)||0)+1)}
export async function flush(env){try{if(!env.adminCounters?.size)return;await env.DB.batch([...env.adminCounters].map(([key,n])=>env.DB.prepare('INSERT INTO admin_metrics(day,metric,count) VALUES(?,?,?) ON CONFLICT(day,metric) DO UPDATE SET count=count+excluded.count').bind(day(),key,n)))}catch{console.warn('Admin telemetry unavailable')}}
export async function track(env,uid){try{const d=day();await env.DB.batch([env.DB.prepare('INSERT INTO admin_accounts(uid,first_seen,last_seen) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET last_seen=excluded.last_seen WHERE last_seen<>excluded.last_seen').bind(uid,d,d),env.DB.prepare('INSERT OR IGNORE INTO admin_activity(day,uid) VALUES(?,?)').bind(d,uid)])}catch{console.warn('Activity telemetry unavailable')}}
export async function forget(env,uid){try{await env.DB.batch([env.DB.prepare('DELETE FROM admin_activity WHERE uid=?').bind(uid),env.DB.prepare('DELETE FROM admin_accounts WHERE uid=?').bind(uid)])}catch{console.warn('Activity deletion unavailable')}}
export function assertAdmin(env,uid,origin){if(!env.ADMIN_UID||uid!==env.ADMIN_UID||origin!==env.APP_ORIGIN)throw Object.assign(new Error('Admin access denied.'),{status:403})}
export function errorCode(e){const status=Number(e?.status);return [400,401,403,404,409,413,429,502,503].includes(status)?String(status):'500'}
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let countCache=null;
async function firebaseCount(env){
 if(!env.FIREBASE_COUNT_SERVICE_ACCOUNT)return {count:null,status:'not_configured'};
 if(countCache&&countCache.project===env.FIREBASE_PROJECT_ID&&Date.now()-countCache.time<600000)return countCache.data;
 try{
  const sa=JSON.parse(env.FIREBASE_COUNT_SERVICE_ACCOUNT);if(sa.project_id!==env.FIREBASE_PROJECT_ID||!sa.client_email||!sa.private_key)throw Error('configuration');
  const enc=new TextEncoder(),now=Math.floor(Date.now()/1000),aud='https://oauth2.googleapis.com/token';
  const header=b64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),body=b64url(enc.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/identitytoolkit',aud,iat:now,exp:now+3600})));
  const jwt=header+'.'+body,pk=Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',pk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(jwt))));
  let r=await fetch(aud,{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt+'.'+sig})});if(!r.ok)throw Error('oauth');const token=(await r.json()).access_token;
  let count=0,next='';for(let i=0;i<10;i++){const u=new URL('https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(env.FIREBASE_PROJECT_ID)+'/accounts:batchGet');u.searchParams.set('maxResults','1000');if(next)u.searchParams.set('nextPageToken',next);r=await fetch(u,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('list');const j=await r.json();count+=(j.users||[]).length;next=j.nextPageToken||'';if(!next)break}
  const data={count,status:next?'lower_bound':'exact',asOf:new Date().toISOString()};countCache={project:env.FIREBASE_PROJECT_ID,time:Date.now(),data};return data;
 }catch{return {count:null,status:'unavailable'}}
}
export async function summary(env){
 const d=day(),from=new Date(Date.now()-6*86400000).toISOString().slice(0,10);
 const q=[['SELECT COUNT(*) AS n FROM admin_accounts'],['SELECT COUNT(*) AS n FROM admin_activity WHERE day=?',d],['SELECT COUNT(*) AS n, COUNT(DISTINCT uid) AS users, MAX(scanned) AS last_scan FROM devices'],['SELECT count FROM usage WHERE day=? AND scope=?',d,'global'],['SELECT day,metric,count FROM admin_metrics WHERE day>=? ORDER BY day',from],['SELECT day,COUNT(*) AS n FROM admin_activity WHERE day>=? GROUP BY day',from],['SELECT day,count FROM usage WHERE day>=? AND scope=?',from,'global'],['SELECT value FROM admin_meta WHERE key=?','started']];
 const results=await env.DB.batch(q.map(([sql,...args])=>{let p=env.DB.prepare(sql);return args.length?p.bind(...args):p}));const rows=results.map(x=>x.results||[]),one=i=>rows[i][0]||{};
 const metrics=Object.fromEntries(rows[4].filter(x=>x.day===d).map(x=>[x.metric,x.count]));
 const max=Number(env.AI_GLOBAL_DAILY_LIMIT||30),used=Number(one(3).count||0);
 return {day:d,generatedAt:new Date().toISOString(),started:one(7).value||null,trackedAccounts:one(0).n||0,registered:await firebaseCount(env),activeToday:one(1).n||0,devices:one(2).n||0,deviceUsers:one(2).users||0,lastScan:one(2).last_scan||null,ai:{used,limit:max,remaining:Math.max(0,max-used),perUser:Number(env.AI_USER_DAILY_LIMIT||8),model:env.GEMINI_MODEL},metrics,history:{metrics:rows[4],activity:rows[5],usage:rows[6]},links:{firebase:'https://console.firebase.google.com/project/'+encodeURIComponent(env.FIREBASE_PROJECT_ID)+'/authentication/users',gemini:'https://aistudio.google.com/usage',cloudflare:'https://dash.cloudflare.com/'}};
}
