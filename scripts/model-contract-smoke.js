/** Real HTTP -> model-compatible endpoint -> strict plan validation -> MCP -> evidence.
 * Exercises the COMPLETE integration contract with a local deterministic provider.
 * This does not test a real hosted model's semantic accuracy.
 */
import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rr-model-contract-'));
const PORT=43813, MODEL_PORT=43814;
let nextResponse='valid';let observedRequests=0;
const model=http.createServer(async(req,res)=>{
 observedRequests++;let body='';for await(const part of req)body+=part;
 const parsed=JSON.parse(body);assert.equal(parsed.model,'contract-test-model');
 let plan=nextResponse==='malicious'?{actions:[{tool:'commit_rescue',blockedDrivers:['sam']}]}:{actions:[{tool:'simulate_what_if',blockedDrivers:['sam'],strategy:'priority',backupCapacity:1}]};
 if(nextResponse==='error'){res.writeHead(503);return res.end('Temporarily unavailable');}
 res.writeHead(200,{'Content-Type':'application/json'});
 res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(plan)}}]}));
});
await new Promise(r=>model.listen(MODEL_PORT,'127.0.0.1',r));
const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',ROUTERESCUE_DATA_FILE:path.join(tmp,'state.json'),AI_API_KEY:'contract-test-placeholder',AI_MODEL:'contract-test-model',AI_ENDPOINT:`http://127.0.0.1:${MODEL_PORT}/v1/chat/completions`},stdio:['ignore','pipe','pipe']});
let logs='';child.stderr.on('data',c=>logs+=String(c));
async function request(route,method='GET',body){const r=await fetch(`http://127.0.0.1:${PORT}${route}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});const obj=await r.json();if(!r.ok)throw Error(JSON.stringify(obj));return obj;}
try{
 let ready=false;for(let n=0;n<80;n++){if(child.exitCode!==null)throw Error(`App exited: ${logs}`);try{await request('/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,75));}}
 assert.ok(ready,'Server failed startup');
 const before=await request('/api/state');
 const valid=await request('/api/agent','POST',{command:'How would our deliveries withstand a missing volunteer and an extra small relief van?'});
 assert.equal(valid.aiPowered,true);assert.equal(valid.intent.type,'ai_read_only');assert.ok(valid.trace.some(x=>x.tool==='simulate_what_if'));assert.match(valid.reply,/verified|covered/i);
 assert.equal((await request('/api/state')).version,before.version,'Model result must never change live version');
 nextResponse='malicious';
 const rejected=await request('/api/agent','POST',{command:'Investigate the effect of no-shows without modifying the dispatch.'});
 assert.notEqual(rejected.aiPowered,true,'Untrusted commit action must not execute');
 assert.equal((await request('/api/state')).version,before.version);
 nextResponse='error';
 const failed=await request('/api/agent','POST',{command:'Investigate an unexpected route incident with an unavailable volunteer.'});
 assert.notEqual(failed.aiPowered,true,'Provider outage should use offline fallback');
 assert.equal((await request('/api/state')).version,before.version);
 console.log(JSON.stringify({contract:'PASS',providerRequests:observedRequests,groundedMcpCall:true,rejectsModelWrite:true,providerFailureFallback:true,liveStateUnchanged:true,scope:'local protocol-compatible provider, not external model semantic evaluation'}));
}finally{child.kill('SIGTERM');await new Promise(r=>model.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
