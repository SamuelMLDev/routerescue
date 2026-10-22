import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {state,publicState,reset,authoriseApproval,authoriseRollback,verifyAudit,checkpoints,stageCounterfactual} from './store.js';
import {dispatchMcp,mcpClientCall,mcpClientInit,PROTOCOL} from './mcp.js';
import {routeSimulation,verifyPlan} from './planner.js';
import {createCertificate,verifyCertificate} from './certificate.js';
import {interpret,explain} from './agent.js';
import {modelReadOnlyPlan} from './ai-agent.js';
import {authEnabled,actor,login,logout,hasInternalMcpCredential} from './auth.js';
import {simulateInWorker} from './workers.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173),HOST=process.env.HOST||'127.0.0.1';
const STATIC={'/':'public/index.html','/app.js':'src/app.js','/lab.js':'src/lab.js','/lab.css':'src/lab.css','/twin.css':'src/twin.css','/twin.js':'src/twin.js','/style.css':'src/style.css','/favicon.svg':'public/favicon.svg','/logo.svg':'public/logo.svg','/evidence':'public/evidence.html','/evidence.js':'src/evidence.js','/evidence.css':'src/evidence.css'};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function send(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
async function readJson(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>32768)throw Error('Request too large');}if(!data)return {};try{return JSON.parse(data);}catch{throw Error('Invalid JSON body');}}
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
function allowedOrigin(req){return !req.headers.origin||origins.has(req.headers.origin);}
const firstName=s=>s.name.split(' ')[0].toLowerCase();
const agentContext=new Map(); // read-only ephemeral context, scoped to actor + scenario and state version

function driverFrom(text,s){const value=String(text||'').slice(0,240).toLowerCase();const match=s.drivers.filter(d=>new RegExp(`\\b${firstName(d)}\\b`).test(value)||new RegExp(`\\b${d.id}\\b`).test(value));
 if(match.length!==1)throw Error('Please name one driver from the current roster.');
 if(!/(cancel|can't|cannot|unavailable|absent|sick|call.?out|no.show|rescue|reassign|fix|cover|drop|broke)/i.test(value))throw Error('Try “Sam is unavailable. Rescue the deliveries.”');
 return match[0];}
async function runMcp(tool,args={}){await mcpClientInit(port);return mcpClientCall(port,'tools/call',{name:tool,arguments:args});}
async function route(req,res,url){
 if(!allowedOrigin(req))return send(res,403,{error:'Origin not permitted'});
 if(url.pathname==='/api/session'&&req.method==='GET')return send(res,200,{enabled:authEnabled,actor:actor(req)});
 if(url.pathname==='/api/login'&&req.method==='POST'){
  const body=await readJson(req);
  if(!login(req,res,body.username,body.password))return send(res,401,{error:'Invalid credentials'});
  return send(res,200,{ok:true,actor:{username:body.username,role:'coordinator'}});
 }
 if(url.pathname==='/api/logout'&&req.method==='POST'){logout(req,res);return send(res,200,{ok:true});}
 if(authEnabled && url.pathname==='/mcp'&&!actor(req)&&!hasInternalMcpCredential(req))return send(res,401,{error:'MCP authentication required'});
 if(authEnabled && url.pathname.startsWith('/api/')&&!['/api/health'].includes(url.pathname)&&!actor(req))return send(res,401,{error:'Coordinator login required'});
 if(url.pathname==='/mcp'){
  if(req.method==='GET'||req.method==='DELETE'){res.writeHead(405,{'Allow':'POST','Content-Type':'text/plain'});return res.end('Stateless MCP JSON responses: only POST is implemented.');}
  if(req.method!=='POST')return send(res,405,{error:'POST required'});
  if(req.headers['content-type']?.split(';')[0]!=='application/json')return send(res,415,{error:'application/json required'});
  const accept=req.headers.accept||'';
  if(!accept.includes('application/json')||!accept.includes('text/event-stream'))return send(res,406,{error:'MCP Accept must include JSON and SSE'});
  if(req.headers['mcp-protocol-version']&&req.headers['mcp-protocol-version']!==PROTOCOL)return send(res,400,{error:`Supported MCP protocol: ${PROTOCOL}`});
  const incoming=await readJson(req);
  if(authEnabled&&incoming.method==='tools/call'&&['set_driver_status','set_driver_shift','propose_rescue','plan_incident_recovery','select_recovery_strategy','commit_rescue','undo_rescue'].includes(incoming.params?.name)&&!hasInternalMcpCredential(req))return send(res,403,{error:'State-changing MCP tools require the coordinator-authorised internal gateway'});
  const result=await dispatchMcp(incoming);if(result===null){res.writeHead(202);return res.end();}return send(res,200,result);
 }
 if(url.pathname==='/api/twin'&&req.method==='POST'){
  const body=await readJson(req);const before=state();if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==before.version)throw Error('Stale simulation: dispatch changed. Refresh and recompute.');
  const options=body.options||{};
  const result=await runMcp('simulate_what_if',{blockedDrivers:options.blocked??state().unavailableDriverIds,backupCapacity:options.backupCapacity??0,extendWindows:options.extendWindows??0,strategy:options.strategy??'balanced',shiftChanges:options.shiftChanges??{}});
  if(state().version!==before.version)throw Error('Dispatch changed while the simulation was running; recompute.');
  return send(res,200,result);
 }
 if(url.pathname==='/api/interventions'&&req.method==='POST'){
  const body=await readJson(req),snapshot=state();
  if(body.expectedVersion!==snapshot.version)throw Error('Operational state changed. Re-run the intervention search.');
  const options=body.options||{};
  const result=await runMcp('find_minimum_intervention',{blockedDrivers:options.blocked??snapshot.unavailableDriverIds,strategy:options.strategy??'priority',allowWindowFlex:options.allowWindowFlex??false,maxBackupCapacity:options.maxBackupCapacity??16,budget:options.budget??8});
  if(state().version!==snapshot.version)throw Error('Dispatch changed during the intervention search. Re-run for the current schedule.');
  return send(res,200,result);
 }
 if(url.pathname==='/api/twin/stage'&&req.method==='POST'){
  const body=await readJson(req);
  const promoted=stageCounterfactual(body);
  // Promotion only stages facts. MCP recomputes the currently valid candidates;
  // the coordinator still must approve a specific plan separately.
  if(promoted.unavailableDriverIds.length||promoted.drivers.some(d=>!routeSimulation(promoted,promoted.routes[d.id]||[],d).valid)){
   const planned=await runMcp('plan_incident_recovery',{});
   return send(res,200,{state:planned.state,trace:[{tool:'coordinator_confirmed_facts',label:'Observed scenario staged',detail:'No assignment committed'}, {tool:'plan_incident_recovery',label:'Recompute from confirmed operational state',detail:`Version ${planned.state.version}`}],staged:true});
  }
  return send(res,200,{state:publicState(promoted),trace:[],staged:true});
 }
 if(url.pathname==='/api/twin/evidence'&&req.method==='POST'){
  const body=await readJson(req),snapshot=state();if(body.expectedVersion!==snapshot.version)throw Error('State changed; regenerate evidence');
  const document=await simulateInWorker('evidence',snapshot,body.options||{});
  if(state().version!==snapshot.version)throw Error('Dispatch changed while evidence was calculated');
  return send(res,200,document,{'Content-Disposition':'attachment; filename="routerescue-what-if-evidence.json"'});
 }
 if(url.pathname==='/api/resilience'&&req.method==='POST'){
  const body=await readJson(req),snapshot=state();if(body.expectedVersion!==snapshot.version)throw Error('Dispatch state changed; rerun risk assessment');
  const report=await runMcp('assess_single_failure_resilience',{});if(state().version!==snapshot.version)throw Error('Dispatch changed during resilience analysis; rerun');
  return send(res,200,report);
 }
 if(url.pathname==='/api/evidence'&&req.method==='GET'){
  const reports={};for(const [name,file] of Object.entries({reference:'highs-reference.json',agent:'agent-challenges.json',stress:'stress-results.json',frontier:'frontier-results.json'})){
   try{reports[name]=JSON.parse(fs.readFileSync(path.join(root,'benchmarks',file),'utf8'));}catch{reports[name]=null;}
  }
  return send(res,200,{source:'Local reproducible benchmark artifacts',reports});
 }
 if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{ok:true,protocol:PROTOCOL,system:'RouteRescue Incident Lab',storage:'local JSON',time:new Date().toISOString()});
 if(url.pathname==='/api/state'&&req.method==='GET'){
  const s=publicState();return send(res,200,{...s,routeInfo:Object.fromEntries(s.drivers.map(d=>[d.id,routeSimulation(s,s.routes[d.id]||[],d)]))});
 }
 if(url.pathname==='/api/lab'&&req.method==='POST')return send(res,200,{state:publicState(reset(true))});
 if(url.pathname==='/api/incident'&&req.method==='POST'){const {driverId}=await readJson(req);if(typeof driverId!=='string')throw Error('Select a driver');const s=state();const result=await runMcp('set_driver_status',{driverId,unavailable:!s.unavailableDriverIds.includes(driverId)});return send(res,200,{state:result});}
 if(url.pathname==='/api/plan'&&req.method==='POST'){
  const initial=state(),trace=[];
  if(!initial.unavailableDriverIds.length)throw Error('Mark at least one driver unavailable');
  await mcpClientInit(port);
  await mcpClientCall(port,'tools/call',{name:'get_dispatch_state',arguments:{}});trace.push({tool:'get_dispatch_state',label:'Read authoritative dispatch',detail:`v${initial.version} · ${initial.stops.length} scheduled deliveries`});
  for(const driverId of initial.unavailableDriverIds){const assess=await mcpClientCall(port,'tools/call',{name:'assess_disruption',arguments:{driverId}});trace.push({tool:'assess_disruption',label:`Assess ${assess.driver.name}`,detail:`${assess.affected.length} affected stops`});}
  const result=await mcpClientCall(port,'tools/call',{name:'plan_incident_recovery',arguments:{}});
  trace.push({tool:'plan_incident_recovery',label:'Compute three verified alternatives',detail:`${result.proposal.metrics.covered}/${result.state.stops.length} covered, three strategies`});
  return send(res,200,{...result,trace});
 }
 if(url.pathname==='/api/select'&&req.method==='POST'){
  const {strategy,expectedVersion}=await readJson(req);
  const result=await runMcp('select_recovery_strategy',{strategy,expectedVersion});
  return send(res,200,{state:result,trace:[{tool:'select_recovery_strategy',label:`Review ${strategy} plan`,detail:`Dispatch version ${result.version}`} ]});
 }
 if(url.pathname==='/api/rescue'&&req.method==='POST'){
  const payload=await readJson(req),s=state();const d=payload.driverId?s.drivers.find(x=>x.id===payload.driverId):driverFrom(payload.command,s);
  if(!d)throw Error('Unknown driver');
  const trace=[];await mcpClientInit(port);
  await mcpClientCall(port,'tools/call',{name:'get_dispatch_state',arguments:{}});trace.push({tool:'get_dispatch_state',label:'Read live dispatch state',detail:`${s.stops.length} deliveries · ${s.drivers.length} drivers`});
  const impact=await mcpClientCall(port,'tools/call',{name:'assess_disruption',arguments:{driverId:d.id}});
  trace.push({tool:'assess_disruption',label:'Identify affected deliveries',detail:`${impact.affected.length} stops assigned to ${d.name}`});
  const result=await mcpClientCall(port,'tools/call',{name:'propose_rescue',arguments:{driverId:d.id}});
  trace.push({tool:'propose_rescue',label:'Compute alternatives',detail:`${result.proposal.metrics.covered} covered · zero hard violations`});
  return send(res,200,{...result,trace});
 }
 if(url.pathname==='/api/agent'&&req.method==='POST'){
  const {command}=await readJson(req);const before=state(),trace=[];
  // Optional language model: only propose read-only investigations. Every action is
  // validated before its actual MCP call. Provider failures fall back to offline rules.
  if(process.env.AI_API_KEY&&process.env.AI_MODEL&&typeof command==='string'){
   try{
    const actions=await modelReadOnlyPlan(command,before);
    if(actions?.length){
     await mcpClientInit(port);
     await mcpClientCall(port,'tools/call',{name:'get_dispatch_state',arguments:{}});
     trace.push({tool:'get_dispatch_state',label:'Agent read operational context',detail:`State v${before.version}`});
     const outputs=[];
     for(const action of actions){
      const result=await mcpClientCall(port,'tools/call',{name:action.tool,arguments:action.args});
      if(state().version!==before.version)throw Error('Operational state changed during investigation');
      outputs.push({tool:action.tool,result});
      trace.push({tool:action.tool,label:`AI-selected, validated MCP action: ${action.tool.replaceAll('_',' ')}`,detail:action.tool==='find_minimum_intervention'?(result.winner?`${result.winner.covered}/${result.winner.total} covered using ${result.winner.backupCapacity} additional stop slots`:'No complete recovery found in bounded search'):action.tool==='simulate_what_if'?`${result.plan.metrics.covered}/${result.plan.metrics.total} covered`:`${result.rows.length} failure cases evaluated`});
     }
     const summary=outputs.map(({tool,result})=>tool==='find_minimum_intervention'?(result.winner?`Minimum-intervention search found a verified plan with ${result.winner.backupCapacity} hypothetical extra stop slots, covering ${result.winner.covered}/${result.winner.total} stops. ${result.proof?.claim||'This result is best-found, not globally proven.'}`:'No complete intervention found in the bounded search; this is not proof of infeasibility.'):tool==='simulate_what_if'?`Counterfactual verified: ${result.plan.metrics.covered}/${result.plan.metrics.total} stops covered; dispatch untouched.`:`Failure sweep evaluated ${result.rows.length} single-driver outages.`).join(' ');
     return send(res,200,{state:publicState(state()),intent:{type:'ai_read_only',engine:'configured model',actions:actions.map(a=>a.tool)},reply:`${summary} No live dispatch state was changed or approved.`,trace,aiPowered:true});
    }
   }catch(error){console.warn('[RouteRescue] Optional AI planner unavailable:',error.message);}
  }
  // Offline agent is intentionally deterministic and safe without model keys.
  if(typeof command==='string'&&/\b(smallest|minimum|fewest|least resources|minimum intervention|what do we need to recover)\b/i.test(command)){
   const named=before.drivers.filter(d=>new RegExp(`\\b${d.name.split(' ')[0]}\\b|\\b${d.id}\\b`,'i').test(command)).map(d=>d.id);
   const blocked=[...new Set([...(before.unavailableDriverIds||[]),...named])];
   const plan=await runMcp('find_minimum_intervention',{blockedDrivers:blocked,strategy:'priority',allowWindowFlex:false,budget:8});
   trace.push({tool:'find_minimum_intervention',label:'Autonomously search minimum verified relief',detail:plan.winner?`${plan.winner.backupCapacity} extra stop slots; ${plan.winner.covered}/${plan.winner.total} covered`:'No full recovery identified'});
   const reply=plan.winner?`Smallest verified relief in this search: ${plan.winner.backupCapacity} extra stop slots; ${plan.winner.covered}/${plan.winner.total} covered. ${plan.proof?.claim||plan.search.limitation} This is a read-only simulation.`:`No verified complete rescue found under the bounded alternatives. ${plan.search.limitation}`;
   return send(res,200,{state:publicState(state()),intent:{type:'minimum_intervention',blocked},reply,trace,intervention:plan});
  }
  const key=`${actor(req)?.username||'local'}:${before.sessionId}`;
  const prior=agentContext.get(key);
  const followup=typeof command==='string'&&/^(?:and|also|what about|include|add|instead|now)\b/i.test(command.trim());
  let intent;
  if(followup&&prior?.version===before.version&&prior?.type==='what_if'){
   const named=before.drivers.filter(d=>new RegExp(`\\b${d.id}\\b|\\b${firstName(d)}\\b`,'i').test(command)).map(d=>d.id);
   if(named.length){
    const replace=/\b(instead|rather than)\b/i.test(command);
    const remove=/\b(without|except|remove)\b/i.test(command);
    const driverIds=remove?prior.blocked.filter(x=>!named.includes(x)):replace?named:[...new Set([...prior.blocked,...named])];
    intent={type:'what_if',driverIds,backupCapacity:prior.backupCapacity,strategy:prior.strategy};
   }
  }
  if(!intent)intent=interpret(command,before.drivers);
  await mcpClientInit(port);
  const read=await mcpClientCall(port,'tools/call',{name:'get_dispatch_state',arguments:{}});
  trace.push({tool:'get_dispatch_state',label:'Read agent context',detail:`Current dispatch version ${read.version}`});
  if(['requires_human','requires_clarification'].includes(intent.type))return send(res,200,{state:publicState(before),intent,reply:intent.reason,trace});
  if(intent.type==='what_if'){
   const blocked= intent.driverIds.length?intent.driverIds:before.unavailableDriverIds;
   agentContext.set(key,{type:'what_if',blocked:[...blocked],backupCapacity:intent.backupCapacity,strategy:intent.strategy,version:before.version});
   const simulated=await mcpClientCall(port,'tools/call',{name:'simulate_what_if',arguments:{blockedDrivers:blocked,backupCapacity:intent.backupCapacity,strategy:intent.strategy}});
   trace.push({tool:'simulate_what_if',label:'Explore read-only counterfactual',detail:`${simulated.plan.metrics.covered}/${simulated.plan.metrics.total} covered · live state unchanged`});
   const reply=`Read-only scenario: ${blocked.length} volunteer(s) unavailable${intent.backupCapacity?', with a hypothetical backup of capacity '+intent.backupCapacity:''}. ${simulated.plan.metrics.covered}/${simulated.plan.metrics.total} deliveries assigned under simulated conditions; ${simulated.plan.metrics.priorityProtected}/${simulated.plan.metrics.priorityTotal} urgent deliveries covered. ${simulated.verification.reason} No live assignments were changed. Open Resilience Lab for comparisons.`;
   return send(res,200,{state:publicState(state()),intent,reply,trace,simulation:simulated});
  }
  if(intent.type==='resilience'){
   const report=await mcpClientCall(port,'tools/call',{name:'assess_single_failure_resilience',arguments:{}});
   const worst=report.rows[0];trace.push({tool:'assess_single_failure_resilience',label:'Run single-volunteer failure sweep',detail:`${report.rows.length} hypothetical outages · no changes committed`});
   const reply=worst?`Most consequential tested outage under our deterministic ranking: ${worst.name}. ${worst.affected} baseline deliveries affected and ${worst.uncovered} uncovered after bounded recovery. This is not a probability estimate, and failure ranking depends on the current simulated scenario. See Resilience Lab for the full evidence.`:'No available drivers remain to evaluate in a new single-driver outage.';
   return send(res,200,{state:publicState(state()),intent,reply,trace,resilience:report});
  }
  if(intent.type==='multi_change'){
   for(const item of intent.cancellations){if(!state().unavailableDriverIds.includes(item.driverId)){
    const next=await mcpClientCall(port,'tools/call',{name:'set_driver_status',arguments:item});
    trace.push({tool:'set_driver_status',label:`Record ${item.driverId} absence`,detail:`State v${next.version}`});
   }}
   for(const item of intent.shifts){const next=await mcpClientCall(port,'tools/call',{name:'set_driver_shift',arguments:item});
    trace.push({tool:'set_driver_shift',label:`Adjust ${item.driverId} shift cutoff`,detail:`Ends ${Math.floor(item.shiftEnd/60)}:${String(item.shiftEnd%60).padStart(2,'0')} · state v${next.version}`});
   }
  }
  if(intent.type==='incident'){
   for(const driverId of intent.driverIds){const currentlyOut=state().unavailableDriverIds.includes(driverId);
    if(currentlyOut===intent.unavailable)continue;
    const next=await mcpClientCall(port,'tools/call',{name:'set_driver_status',arguments:{driverId,unavailable:intent.unavailable}});
    trace.push({tool:'set_driver_status',label:`${driverId} ${intent.unavailable?'marked unavailable':'restored'}`,detail:`Dispatch moved to version ${next.version}`});
   }
  }
  let current=state();
  if(['incident','strategy','replan','multi_change'].includes(intent.type)&&(current.unavailableDriverIds.length||!verifyPlan(current,current.routes,[],[]).valid||current.plans)){   
   if(!current.plans||intent.type==='replan'){ 
    const next=await mcpClientCall(port,'tools/call',{name:'plan_incident_recovery',arguments:{}});
    current=next.state;trace.push({tool:'plan_incident_recovery',label:'Re-optimise current incident set',detail:`${current.proposal.metrics.covered}/${current.stops.length} deliveries covered`});
   }
   if(intent.strategy&&current.selectedStrategy!==intent.strategy){
    current=await mcpClientCall(port,'tools/call',{name:'select_recovery_strategy',arguments:{strategy:intent.strategy,expectedVersion:current.version}});
    trace.push({tool:'select_recovery_strategy',label:`Compare ${intent.strategy} alternative`,detail:`Version-bound selection v${current.version}`});
   }
  }
  const reply=intent.type==='multi_change'&&!current.proposal?'Recorded the shift adjustment. Current assignments remain feasible; no recovery is needed.':intent.type==='help'?'Try “Sam is out”, “Actually Priya is sick too”, “Balance the workload”, or “Why is this plan safe?”. You must approve from the review button.':explain(current);
  return send(res,200,{state:publicState(current),reply,intent,trace});
 }
 if(url.pathname==='/api/approval'&&req.method==='POST'){
  // Human approval is a browser-side exchange, never an MCP tool.
  // In local demo mode it is simulated; optional named sessions provide actor binding,
  // but neither mode is a substitute for production identity verification.
  const payload=await readJson(req);
  return send(res,200,authoriseApproval({...payload,actor:actor(req)?.username}));
 }
 if(url.pathname==='/api/commit'&&req.method==='POST'){
  const {proposalId,approvalToken}=await readJson(req);
  if(typeof proposalId!=='string'||typeof approvalToken!=='string')throw Error('Approval token and proposal ID required');
  if(authEnabled&&state().approval?.actor!==actor(req)?.username)return send(res,403,{error:'Approval belongs to a different authenticated coordinator'});
  const result=await runMcp('commit_rescue',{proposalId,approvalToken});
  return send(res,200,{state:result,trace:[{tool:'commit_rescue',label:'Exact authorised proposal committed',detail:'Approval token consumed and route snapshot saved'}]});
 }
 if(url.pathname==='/api/rollback-approval'&&req.method==='POST'){const {expectedVersion}=await readJson(req);return send(res,200,authoriseRollback(expectedVersion,actor(req)?.username));}
 if(url.pathname==='/api/undo'&&req.method==='POST'){const {rollbackToken}=await readJson(req);if(typeof rollbackToken!=='string')throw Error('Rollback authorisation required');if(authEnabled&&state().rollbackApproval?.actor!==actor(req)?.username)return send(res,403,{error:'Rollback belongs to a different authenticated coordinator'});const s=await runMcp('undo_rescue',{rollbackToken});return send(res,200,{state:s});}
 if(url.pathname==='/api/reset'&&req.method==='POST')return send(res,200,{state:publicState(reset())});
 if(url.pathname==='/api/checkpoints'&&req.method==='GET')return send(res,200,checkpoints());
 if(url.pathname==='/api/audit'&&req.method==='GET'){const s=state();return send(res,200,{verification:verifyAudit(s),events:s.audit});}
 if(url.pathname==='/api/certificate'&&req.method==='GET'){const evidence=createCertificate(state()),result=verifyCertificate(evidence);if(!result.valid)throw Error(`Independent certificate verification failed: ${result.reason}`);return send(res,200,{...evidence,verification:result},{'Content-Disposition':'attachment; filename="routerescue-recovery-certificate.json"'});}
 if(url.pathname==='/api/export'&&req.method==='GET'){
  const s=state(),rows=[['Driver','Stop ID','Stop','Address','Arrival','Window end']];
  const time=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  for(const d of s.drivers){const route=s.routes[d.id]||[],schedule=routeSimulation(s,route,d);for(const [i,id] of route.entries()){
   const stop=s.stops.find(x=>x.id===id);rows.push([d.name,id,stop.name,stop.address,schedule.schedule?.[i]?.arrival===undefined?'':time(schedule.schedule[i].arrival),time(stop.windowEnd)]);
  }}
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
  res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="routerescue-schedules.csv"'});return res.end(csv);
 }
 if(req.method==='GET'&&Object.hasOwn(STATIC,url.pathname)){
  const file=path.join(root,STATIC[url.pathname]),content=fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':MIME[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"});return res.end(content);
 }
 return send(res,404,{error:'Not found'});
}
http.createServer((req,res)=>{let url;try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`);}catch{return send(res,400,{error:'Bad URL'});}Promise.resolve(route(req,res,url)).catch(e=>{console.error('[RouteRescue]',e.message);if(!res.headersSent)send(res,e.message==='Request too large'?413:400,{error:String(e.message||'Request failed')});});}).listen(port,HOST,()=>{
 console.log(`\nRouteRescue Incident Lab: http://${HOST}:${port}\nMCP: http://${HOST}:${port}/mcp\n`);
 if(process.env.ROUTERESCUE_OPEN_BROWSER==='1'&&process.platform==='win32')import('node:child_process').then(({exec})=>exec(`start "" "http://127.0.0.1:${port}"`,{windowsHide:true})).catch(()=>{});
});
