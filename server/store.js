/** Local transactional domain store. All state changes are synchronously atomically persisted. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {calculateStrategies,verifyPlan,STRATEGIES,routeSimulation} from './planner.js';
import {normalizeWhatIf} from './twin.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dbPath=process.env.ROUTERESCUE_DATA_FILE||path.join(root,'data','state.json');
const sha=input=>crypto.createHash('sha256').update(input).digest('hex');
const canonical=value=>JSON.stringify(value);
const archiveRoot=path.join(path.dirname(dbPath),'history');
const initialPath=lab=>path.join(root,'seed',lab?'incident-lab.json':'demo.json');
function write(next){
 fs.mkdirSync(path.dirname(dbPath),{recursive:true});const tmp=`${dbPath}.${process.pid}.tmp`;
 fs.writeFileSync(tmp,JSON.stringify(next,null,2));fs.renameSync(tmp,dbPath);
 // Read-only forensic checkpoints; a historical snapshot is never a new live state.
 // Fail-closed for live writes; a checkpoint write failure is reported but does not undo
 // an already-atomic live commit. This mechanism is local, not trusted remote storage.
 if(next.sessionId){
  try{const directory=path.join(archiveRoot,next.sessionId);fs.mkdirSync(directory,{recursive:true});
   const filename=`event-${String(next.audit.length).padStart(5,'0')}-${String(next.version).padStart(5,'0')}.json`;
   fs.writeFileSync(path.join(directory,filename),JSON.stringify(next));
  }catch(e){console.error('[forensic checkpoint]',e.message);}
 }
}
function newSeed(lab=false){const s=JSON.parse(fs.readFileSync(initialPath(lab),'utf8'));return {...s,lab,sessionId:crypto.randomUUID(),unavailableDriverIds:[],incidents:[],plans:null,selectedStrategy:null,proposal:null,history:null,baseline:null,approval:null,rollbackApproval:null,audit:[]};}
export function state(){if(!fs.existsSync(dbPath))write(newSeed(false));const s=JSON.parse(fs.readFileSync(dbPath,'utf8'));return {...s,unavailableDriverIds:s.unavailableDriverIds??(s.unavailableDriverId?[s.unavailableDriverId]:[]),incidents:s.incidents||[],audit:s.audit||[]};}
function log(s,kind,detail){const previousHash=s.audit.at(-1)?.hash||'GENESIS';const event={sequence:s.audit.length+1,at:new Date().toISOString(),kind,detail,previousHash};event.hash=sha(canonical(event));s.audit.push(event);s.log=[{kind,text:detail.message||kind,at:event.at},...(s.log||[])].slice(0,30);}
export function verifyAudit(s=state()){let previousHash='GENESIS';for(let i=0;i<s.audit.length;i++){const {hash,...event}=s.audit[i];if(event.sequence!==i+1||event.previousHash!==previousHash||sha(canonical(event))!==hash)return {valid:false,reason:`Audit chain invalid at event ${i+1}`};previousHash=hash;}return {valid:true,events:s.audit.length,head:previousHash};}
export function reset(lab=false){const s=newSeed(lab);log(s,'reset',{message:lab?'Incident Lab loaded: fictional 40-stop scenario':'Demo reset: fictional 16-stop scenario'});write(s);return s;}
function assertEditable(s){if(s.mode==='committed')throw Error('Committed routes must be rolled back before editing incidents');}
/** One first-change snapshot is the recovery baseline, not the last damaged state. */
function rememberBaseline(s){if(s.baseline)return;
 s.baseline=structuredClone({routes:s.routes,drivers:s.drivers,stops:s.stops,unavailableDriverIds:s.unavailableDriverIds,incidents:s.incidents,unavailableDriverId:s.unavailableDriverId,mode:s.mode});
}
export function setIncident(driverId,unavailable=true){const s=state();assertEditable(s);const d=s.drivers.find(x=>x.id===driverId);if(!d)throw Error('Unknown volunteer');
 if(typeof unavailable!=='boolean')throw Error('Unavailable must be boolean');
 const previous=s.unavailableDriverIds,already=previous.includes(driverId);if(already===unavailable)return s;
 s.unavailableDriverIds=unavailable?[...previous,driverId]:previous.filter(x=>x!==driverId);
 s.unavailableDriverId=s.unavailableDriverIds[0]||null;
 s.incidents=s.unavailableDriverIds.map((id,index)=>({driverId:id,kind:'driver_unavailable',sequence:index+1}));
 s.plans=null;s.proposal=null;s.approval=null;s.selectedStrategy=null;s.mode='normal';s.version++;
 log(s,'incident',{driverId,active:unavailable,message:`${d.name} ${unavailable?'marked unavailable':'restored to availability'}`});write(s);return s;
}
/** Shift adjustments are auditable operational facts, not UI-only simulation knobs. */
export function setDriverShift(driverId,shiftEnd){const s=state();assertEditable(s);
 const d=s.drivers.find(x=>x.id===driverId);if(!d)throw Error('Unknown volunteer');
 if(!Number.isInteger(shiftEnd)||shiftEnd<(d.shiftStart??540)||shiftEnd>1080)throw Error('Shift end must be a valid minute between shift start and 18:00');
 if(d.shiftEnd===shiftEnd)return s;
 rememberBaseline(s);const previous=d.shiftEnd;d.shiftEnd=shiftEnd;
 s.plans=null;s.proposal=null;s.approval=null;s.selectedStrategy=null;s.mode='normal';s.version++;
 log(s,'shift_update',{driverId,shiftEnd,previous,message:`${d.name} shift end changed to ${String(Math.floor(shiftEnd/60)).padStart(2,'0')}:${String(shiftEnd%60).padStart(2,'0')}`});
 write(s);return s;
}
/** Explicitly promote verified assumptions to observed operational facts; still no approval.
 * A separate exact-proposal human token remains necessary to commit assignments.
 */
export function stageCounterfactual({expectedVersion,options,acknowledged}){
 const s=state();assertEditable(s);
 if(!Number.isInteger(expectedVersion)||expectedVersion!==s.version)throw Error('Live state changed. Recheck the scenario before staging.');
 if(acknowledged!==true)throw Error('Coordinator confirmation of observed facts is required');
 if(options?.extendWindows)throw Error('Delivery windows cannot be extended as operational facts without recipient agreements');
 if(s.drivers.some(d=>d.id==='backup')&&options?.backupCapacity)throw Error('Backup driver already registered; do not double-count capacity');
 const {state:scenario,assumptions}=normalizeWhatIf(s,options);
 // Do not accept a scenario that already has a committed or unknown driver added.
 if(scenario.drivers.length>s.drivers.length+1)throw Error('Unexpected additional drivers');
 rememberBaseline(s);s.drivers=scenario.drivers;s.routes=scenario.routes;
 s.unavailableDriverIds=scenario.unavailableDriverIds;s.unavailableDriverId=s.unavailableDriverIds[0]||null;
 s.incidents=s.unavailableDriverIds.map((id,index)=>({driverId:id,kind:'driver_unavailable',sequence:index+1}));
 s.plans=null;s.proposal=null;s.approval=null;s.selectedStrategy=null;s.mode='normal';s.version++;
 log(s,'facts_confirmed',{message:`Coordinator staged ${s.unavailableDriverIds.length} observed absences${assumptions.backupCapacity?', and confirmed a relief driver of '+assumptions.backupCapacity+' stops':''}. Route assignments are not yet approved.`,sourceVersion:expectedVersion,assumptions});
 write(s);return s;
}
export function toggleIncident(driverId){const s=state();return setIncident(driverId,!s.unavailableDriverIds.includes(driverId));}
export function assess(driverId){const s=state();const driver=s.drivers.find(d=>d.id===driverId);if(!driver)throw Error('Unknown driver');assertEditable(s);return {driver,affected:s.routes[driverId].map(id=>s.stops.find(x=>x.id===id)),availableDrivers:s.drivers.filter(d=>d.available&&!s.unavailableDriverIds.includes(d.id)&&d.id!==driverId),version:s.version};}
export function generatePlans(){const s=state();assertEditable(s);const impaired=s.drivers.some(d=>d.available&&!s.unavailableDriverIds.includes(d.id)&&!routeSimulation(s,s.routes[d.id]||[],d).valid);
 if(!s.unavailableDriverIds.length&&!impaired)throw Error('Select a driver incident or shorten an active shift before replanning');
 const prepared=calculateStrategies(s,[],STRATEGIES,impaired);s.version++;
 s.plans=Object.fromEntries(STRATEGIES.map(key=>{const p=prepared.strategies[key];const signature=sha(canonical({routes:p.routes,uncovered:p.uncovered,blocked:p.blocked}));return [key,{...p,id:`r${s.version}-${key}-${signature.slice(0,12)}`,signature,sourceVersion:s.version}];}));
 s.selectedStrategy='balanced';s.proposal=s.plans.balanced;s.mode='proposed';s.approval=null;
 log(s,'proposed',{message:`Analysed ${s.unavailableDriverIds.length} incidents; generated three validated recovery strategies`,strategies:STRATEGIES,version:s.version});
 write(s);return {state:s,proposal:s.proposal,plans:s.plans};
}
export function propose(driverId){let s=state();if(!s.unavailableDriverIds.includes(driverId))s=toggleIncident(driverId);return generatePlans();}
export function selectStrategy(strategy,expectedVersion){const s=state();if(s.mode!=='proposed'||!s.plans)throw Error('Generate a proposal first');if(!STRATEGIES.includes(strategy))throw Error('Unknown recovery strategy');if(s.version!==expectedVersion)throw Error('Dispatch has changed; refresh before selecting a strategy');
 s.selectedStrategy=strategy;s.proposal=s.plans[strategy];s.version++;s.approval=null;log(s,'strategy_selected',{message:`Coordinator reviewing ${strategy} recovery strategy`,strategy,version:s.version});write(s);return s;
}
/** Browser-only approval exchange: MCP tools cannot mint authority for themselves. */
export function authoriseApproval({proposalId,expectedVersion,actor='local-demo'}){const s=state();if(s.mode!=='proposed'||s.version!==expectedVersion||!s.proposal||s.proposal.id!==proposalId)throw Error('Proposal expired; refresh the dispatch screen');
 if(s.proposal.uncovered.length)throw Error('Partial recovery needs manual escalation; approval is disabled');
 const check=verifyPlan(s,s.proposal.routes,s.unavailableDriverIds,s.proposal.uncovered);if(!check.valid)throw Error(check.reason);
 const token=crypto.randomBytes(32).toString('hex');s.approval={digest:sha(token),proposalId,version:s.version,signature:s.proposal.signature,expires:Date.now()+120000,actor};
 log(s,'approval_intent',{message:`Coordinator authorised the exact ${s.selectedStrategy} proposal`,proposalId,version:s.version,actor});write(s);
 return {token,proposalId,expiresInSeconds:120};
}
export function commit(proposalId,token){const s=state();const approval=s.approval;
 if(s.mode!=='proposed'||!s.proposal||s.proposal.id!==proposalId||!approval||approval.proposalId!==proposalId||approval.version!==s.version||approval.signature!==s.proposal.signature||Date.now()>approval.expires||typeof token!=='string'||!crypto.timingSafeEqual(Buffer.from(sha(token),'hex'),Buffer.from(approval.digest,'hex')))throw Error('Approval missing, invalid or expired. Review the exact proposal and approve again.');
 if(s.proposal.uncovered.length)throw Error('Cannot commit a partial recovery');
 const check=verifyPlan(s,s.proposal.routes,s.unavailableDriverIds,[]);if(!check.valid)throw Error(check.reason);
 s.history=structuredClone(s.baseline||{routes:s.routes,drivers:s.drivers,stops:s.stops,unavailableDriverIds:[],incidents:[],mode:'normal',unavailableDriverId:null});
 s.routes=structuredClone(s.proposal.routes);s.drivers=s.drivers.map(d=>s.unavailableDriverIds.includes(d.id)?{...d,available:false}:d);
 s.mode='committed';s.version++;s.approval=null;s.rollbackApproval=null;
 log(s,'committed',{message:`Approved ${s.selectedStrategy} recovery saved · ${s.proposal.metrics.covered}/${s.stops.length} stops covered`,proposalId,signature:s.proposal.signature});write(s);return s;
}
export function authoriseRollback(expectedVersion,actor='local-demo'){const s=state();if(s.mode!=='committed'||!s.history||s.version!==expectedVersion)throw Error('Committed schedule has changed; refresh before rollback');
 const token=crypto.randomBytes(32).toString('hex');s.rollbackApproval={digest:sha(token),version:s.version,expires:Date.now()+120000,actor};
 log(s,'rollback_intent',{message:'Coordinator requested a rollback of the committed schedule',version:s.version});write(s);
 return {token,expiresInSeconds:120};
}
export function undo(token){const s=state();if(s.mode!=='committed'||!s.history)throw Error('No committed changes to roll back');
 const a=s.rollbackApproval;if(!a||a.version!==s.version||Date.now()>a.expires||typeof token!=='string'||!crypto.timingSafeEqual(Buffer.from(sha(token),'hex'),Buffer.from(a.digest,'hex')))throw Error('Explicit rollback authority required');
 const h=s.history;s.routes=h.routes;s.drivers=h.drivers;s.stops=h.stops??s.stops;s.unavailableDriverIds=h.unavailableDriverIds;s.incidents=h.incidents;s.unavailableDriverId=h.unavailableDriverId;s.mode=h.mode;
 s.baseline=null;s.history=null;s.proposal=null;s.plans=null;s.selectedStrategy=null;s.approval=null;s.rollbackApproval=null;s.version++;
 log(s,'rollback',{message:'Exact pre-incident dispatch snapshot restored'});write(s);return s;
}
/** Only coordinator-facing DTOs are returned to a browser; never expose token digests. */
export function publicState(s=state()){const {approval,rollbackApproval,baseline,history,...safe}=s;return {...safe,approvalPending:Boolean(approval)};}

/** Forensic replay is read-only. Historical approvals and token digests never leave the server. */
export function checkpoints(limit=30){const s=state();if(!s.sessionId)return {sessionId:null,snapshots:[]};
 const directory=path.join(archiveRoot,s.sessionId);if(!fs.existsSync(directory))return {sessionId:s.sessionId,snapshots:[]};
 const files=fs.readdirSync(directory).filter(n=>/^event-\d+-\d+\.json$/.test(n)).sort().slice(-Math.min(100,limit));
 const snapshots=files.map(file=>{
  const previous=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  const last=previous.audit.at(-1)||{};
  return {version:previous.version,sequence:last.sequence??0,kind:last.kind??'initial',at:last.at??null,detail:last.detail?.message??'',unavailableDriverIds:previous.unavailableDriverIds||[],mode:previous.mode,covered:previous.proposal?.metrics.covered??null,proposalId:previous.proposal?.id??null,auditHead:last.hash??null};
 });
 return {sessionId:s.sessionId,snapshots};
}
