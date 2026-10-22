import {simulateInWorker} from './workers.js';
import {internalMcpSecret} from './auth.js';
/** MCP v2025-11-25, stateless JSON-response Streamable HTTP. */
import {state,publicState,assess,setIncident,propose,generatePlans,selectStrategy,commit,undo,verifyAudit,setDriverShift} from './store.js';
export const PROTOCOL='2025-11-25';
const obj={type:'object',additionalProperties:false};
const schema=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str=(max=120)=>({type:'string',minLength:1,maxLength:max});
const driver=schema({driverId:str(64)});
const tools=[
 {name:'get_dispatch_state',title:'Read dispatch state',description:'Read the live fictional dispatch network, version and current incident list.',inputSchema:obj,annotations:{readOnlyHint:true}},
 {name:'assess_disruption',title:'Assess one cancellation',description:'Inspect the stops and active drivers affected by a cancellation.',inputSchema:driver,annotations:{readOnlyHint:true}},
 {name:'set_driver_status',title:'Record a driver incident',description:'Mark a fictional volunteer unavailable or restore them. Clears stale proposals. Requires explicit coordinator instruction.',inputSchema:{type:'object',properties:{driverId:str(64),unavailable:{type:'boolean'}},required:['driverId','unavailable'],additionalProperties:false},annotations:{destructiveHint:false}},
 {name:'set_driver_shift',title:'Change a volunteer shift cutoff',description:'Record an explicit coordinator shift-end change in minutes since midnight; invalidates every prior proposal. Cannot approve a recovery.',inputSchema:schema({driverId:str(64),shiftEnd:{type:'integer',minimum:540,maximum:1080}}),annotations:{destructiveHint:false}},
 {name:'propose_rescue',title:'Propose driver rescue',description:'Create three constraint-verified candidate plans for a driver who cannot attend; does not commit.',inputSchema:driver,annotations:{destructiveHint:false}},
 {name:'plan_incident_recovery',title:'Analyse all live incidents',description:'Generate competing distance, workload-balance and priority-protection plans; no external actions.',inputSchema:obj,annotations:{destructiveHint:false}},
 {name:'select_recovery_strategy',title:'Review a recovery strategy',description:'Select a strategy to review. Requires current state version. Does not approve or commit.',inputSchema:{type:'object',properties:{strategy:{type:'string',enum:['distance','balanced','priority']},expectedVersion:{type:'integer',minimum:1}},required:['strategy','expectedVersion'],additionalProperties:false},annotations:{destructiveHint:false}},
 {name:'commit_rescue',title:'Commit exactly approved plan',description:'Requires a short-lived coordinator-origin approval token, proposal ID and matching dispatch state. Never self-authorise.',inputSchema:schema({proposalId:str(100),approvalToken:str(100)}),annotations:{destructiveHint:true}},
 {name:'undo_rescue',title:'Restore exact dispatch snapshot',description:'Rollback a committed proposal with a human-issued, single-use rollback token.',inputSchema:schema({rollbackToken:str(100)}),annotations:{destructiveHint:true}},
 {name:'verify_audit',title:'Verify append-only event hashes',description:'Check the SHA-256 hash chain of every recorded decision.',inputSchema:obj,annotations:{readOnlyHint:true}},
 {name:'simulate_what_if',title:'Explore a counterfactual recovery',description:'READ ONLY: simulate specified driver outages, a hypothetical backup vehicle and expanded time windows. Results are verified but may be suboptimal. Does not change dispatch.',inputSchema:{type:'object',properties:{blockedDrivers:{type:'array',items:{type:'string'},maxItems:16},backupCapacity:{type:'integer',minimum:0,maximum:16},extendWindows:{type:'integer',minimum:0,maximum:120},strategy:{type:'string',enum:['distance','balanced','priority']},shiftChanges:{type:'object'}},required:['blockedDrivers'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'find_minimum_intervention',title:'Discover the smallest verified operational intervention',description:'READ ONLY: search a bounded grid of hypothetical backup capacities and optionally delivery-window flexibility. Return independently verified candidate plans and strict capacity proofs only when justified. Never alters live assignments.',inputSchema:{type:'object',properties:{blockedDrivers:{type:'array',items:{type:'string'},maxItems:16},strategy:{type:'string',enum:['distance','balanced','priority']},allowWindowFlex:{type:'boolean'},budget:{type:'integer',minimum:1,maximum:24},maxBackupCapacity:{type:'integer',minimum:0,maximum:16}},required:['blockedDrivers'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'assess_single_failure_resilience',title:'Evaluate operational weak points',description:'READ ONLY: calculate impact of each currently available volunteer suddenly being unavailable. These are deterministic scenarios, not probabilities.',inputSchema:obj,annotations:{readOnlyHint:true}}
];
function bad(schema,args){
 if(args===null||typeof args!=='object'||Array.isArray(args))return true;
 if(Object.keys(args).some(k=>!Object.hasOwn(schema.properties||{},k)))return true;
 if((schema.required||[]).some(k=>!Object.hasOwn(args,k)))return true;
 for(const [key,v] of Object.entries(args)){
  const p=schema.properties[key];
  if(p.type==='integer'){if(!Number.isInteger(v)||v<(p.minimum??-Infinity)||v>(p.maximum??Infinity))return true;}
  else if(p.type==='boolean'){if(typeof v!=='boolean')return true;}
  else if(p.type==='array'){if(!Array.isArray(v)||v.length>(p.maxItems??Infinity)||v.some(x=>p.items?.type==='string'&&typeof x!=='string'))return true;}
  else if(p.type==='object'){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>20||Object.values(v).some(x=>!Number.isInteger(x)))return true;}
  else if(typeof v!=='string'||v.length<(p.minLength??0)||v.length>(p.maxLength??Infinity)||p.enum&&!p.enum.includes(v))return true;
 }
 return false;
}
const ok=(id,result)=>({jsonrpc:'2.0',id,result});
const err=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const content=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:false});
export function dispatchMcp(msg){
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'||Array.isArray(msg))return err(msg?.id??null,-32600,'Invalid JSON-RPC request');
 if(!Object.hasOwn(msg,'id'))return null;
 const {id,method}=msg;
 if(method==='initialize')return ok(id,{protocolVersion:PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:{name:'routerescue',title:'RouteRescue Resilience Engine',version:'5.0.0'},instructions:'Fictional scenario. Always inspect state; plan and compare alternatives, never claim global optimality. Only the human-operated browser can issue a short-lived approval token. Use commit_rescue only with explicitly authorised exact proposal.'});
 if(method==='ping')return ok(id,{});
 if(method==='tools/list')return ok(id,{tools});
 if(method!=='tools/call')return err(id,-32601,`Method not found: ${method}`);
 const {name,arguments:args={}}=msg.params||{},tool=tools.find(t=>t.name===name);
 if(!tool)return err(id,-32602,'Unknown tool');
 if(bad(tool.inputSchema,args))return err(id,-32602,`Invalid arguments for ${name}`);
 if(name==='simulate_what_if'||name==='assess_single_failure_resilience'||name==='find_minimum_intervention'){
  const scenarioArgs=name==='simulate_what_if'?{blocked:args.blockedDrivers,backupCapacity:args.backupCapacity??0,extendWindows:args.extendWindows??0,strategy:args.strategy??'balanced',shiftChanges:args.shiftChanges??{}}:name==='find_minimum_intervention'?{blocked:args.blockedDrivers,strategy:args.strategy??'priority',allowWindowFlex:args.allowWindowFlex??false,maxBackupCapacity:args.maxBackupCapacity??16,budget:args.budget??8}:{};
  return simulateInWorker(name==='simulate_what_if'?'twin':name==='find_minimum_intervention'?'intervene':'risk',state(),scenarioArgs)
    .then(result=>ok(id,content(result)))
    .catch(e=>ok(id,{content:[{type:'text',text:String(e.message||'Simulation failed')}],isError:true}));
 }
 try{
  let value;
  switch(name){
   case 'get_dispatch_state':value=publicState();break;
   case 'assess_disruption':value=assess(args.driverId);break;
   case 'set_driver_status':value=setIncident(args.driverId,args.unavailable);break;
   case 'set_driver_shift':value=setDriverShift(args.driverId,args.shiftEnd);break;
   case 'propose_rescue':value=propose(args.driverId);break;
   case 'plan_incident_recovery':value=generatePlans();break;
   case 'select_recovery_strategy':value=selectStrategy(args.strategy,args.expectedVersion);break;
   case 'commit_rescue':value=commit(args.proposalId,args.approvalToken);break;
   case 'undo_rescue':value=undo(args.rollbackToken);break;
   case 'verify_audit':value=verifyAudit();break;
  }
  if(value?.state)value={...value,state:publicState(value.state)};
  else if(name==='get_dispatch_state')value=publicState(value);
  else if(value?.drivers)value=publicState(value);
  return ok(id,content(value));
 }catch(e){return ok(id,{content:[{type:'text',text:String(e.message||'Tool failed')}],isError:true});}
}
let nextId=1;
export async function mcpClientCall(port,method,params={}){
 const response=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL,'X-RouteRescue-Internal':internalMcpSecret},body:JSON.stringify({jsonrpc:'2.0',id:nextId++,method,params}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(`MCP HTTP ${response.status}`);
 const data=await response.json();if(data.error)throw Error(data.error.message);
 if(data.result?.isError)throw Error(data.result.content?.[0]?.text||'MCP tool failed');
 return data.result?.structuredContent??data.result;
}
export async function mcpClientInit(port){
 const data=await mcpClientCall(port,'initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'incident-lab-simulator',version:'2.0.0'}});
 if(data.protocolVersion!==PROTOCOL)throw Error('MCP handshake failed');
 const response=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL,'X-RouteRescue-Internal':internalMcpSecret},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(4000)});
 if(response.status!==202)throw Error('MCP initialized notification failed');
}
