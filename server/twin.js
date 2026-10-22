/** Read-only operational digital twin. Input is validated; source state is never changed.
 * Simulations are counterfactual estimates against synthetic geometry, not real dispatch actions.
 */
import {calculateStrategies,verifyPlan,STRATEGIES} from './planner.js';
import {createCertificate,verifyCertificate} from './certificate.js';

const integer=(x,lo,hi,name)=>{if(!Number.isInteger(x)||x<lo||x>hi)throw Error(`${name} must be an integer between ${lo} and ${hi}`);return x;};
const keys=(x,allowed,name)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error(`Invalid ${name} fields`);};
export function normalizeWhatIf(source,options={}){
 keys(options,['blocked','backupCapacity','extendWindows','shiftChanges','strategy'], 'simulation');
 const state=structuredClone(source);
 const ids=new Set(state.drivers.map(d=>d.id));
 const blocked=options.blocked===undefined?[...(state.unavailableDriverIds||[])]:options.blocked;
 if(!Array.isArray(blocked)||blocked.length>state.drivers.length||blocked.some(x=>typeof x!=='string'||!ids.has(x))||new Set(blocked).size!==blocked.length)throw Error('Blocked drivers must be unique, known driver IDs');
 const backupCapacity=integer(options.backupCapacity??0,0,16,'Backup capacity');
 const extendWindows=integer(options.extendWindows??0,0,120,'Delivery-window extension');
 const shiftChanges=options.shiftChanges??{};
 keys(shiftChanges,[...ids], 'shift changes');
 for(const [id,end] of Object.entries(shiftChanges)){
  const driver=state.drivers.find(d=>d.id===id);
  const minute=integer(end,driver.shiftStart??540,1080,`${driver.name} shift end`);
  driver.shiftEnd=minute;
 }
 if(backupCapacity){state.drivers.push({id:'backup',name:'Hypothetical backup driver',initials:'HB',vehicle:'Hypothetical relief vehicle',capacity:backupCapacity,maxLoad:backupCapacity,available:true,shiftStart:540,shiftEnd:840,color:'#1c8a9e',skills:[]});state.routes.backup=[];}
 if(extendWindows){state.stops=state.stops.map(s=>({...s,windowEnd:s.windowEnd+extendWindows}));}
 state.mode='normal';state.plans=null;state.proposal=null;state.selectedStrategy=null;
 state.unavailableDriverIds=[...blocked];state.unavailableDriverId=blocked[0]||null;
 const strategy=options.strategy??'balanced';if(!STRATEGIES.includes(strategy))throw Error('Unknown strategy');
 return {state,blocked,strategy,assumptions:{blocked:[...blocked],backupCapacity,extendWindows,shiftChanges:structuredClone(shiftChanges),strategy,sourceVersion:source.version,synthetic:true}};
}
function observedMetrics(state){const check=verifyPlan(state,state.routes,[],[]);if(!check.valid)throw Error('Current schedule is not valid for a healthy scenario: '+check.reason);
 const priorityTotal=state.stops.filter(x=>x.priority==='Priority').length;
 return {total:state.stops.length,covered:state.stops.length,uncovered:0,priorityTotal,priorityProtected:priorityTotal,priorityUncovered:0,totalKm:check.km,moved:0,minimumSlackMinutes:check.minSlack,workloadSpreadMinutes:0,violations:0};}
export function runTwin(source,options={}){
 const {state,blocked,strategy,assumptions}=normalizeWhatIf(source,options);
 let plan,allPlans=null;
 if(blocked.length||Object.keys(assumptions.shiftChanges).length){
  // Evaluate all 3 trade-offs for the interactive what-if panel.
  const strategies=calculateStrategies(state,[],STRATEGIES,true).strategies;
  plan=strategies[strategy];allPlans=Object.fromEntries(Object.entries(strategies).map(([key,p])=>[key,{label:p.label,metrics:p.metrics,uncovered:p.uncovered}]));
 }else{
  const metrics=observedMetrics(state);
  plan={id:'healthy-baseline',label:'Baseline schedule',strategy,blocked:[],routes:state.routes,uncovered:[],metrics,assertions:{hardConstraintsChecked:true,verified:true,optimalityGuaranteed:false},reasoning:['The unchanged baseline passes all hard constraints.']};
 }
 const check=verifyPlan(state,plan.routes,blocked,plan.uncovered);
 if(!check.valid)throw Error('Counterfactual failed route feasibility validation: '+check.reason);
 // Deliberately use a separate, self-contained checker which does not import the optimiser.
 const certificate=createCertificate({...state,mode:'proposed',proposal:{...plan,id:`twin-${source.version}`},selectedStrategy:strategy});
 const independent=verifyCertificate(certificate);
 if(!independent.valid)throw Error('Independent verifier rejected the counterfactual: '+independent.reason);
 const capacity=state.drivers.filter(d=>d.available&&!blocked.includes(d.id)).reduce((n,d)=>n+d.capacity,0);
 const shortfall=Math.max(0,state.stops.length-capacity);
 const reason=plan.uncovered.length===0?'Complete feasible assignment found under the simulated assumptions.':shortfall>0?`Capacity proves at least ${shortfall} deliveries must be uncovered (only ${capacity} stop slots for ${state.stops.length} deliveries).`:'Bounded search found partial coverage; this does not prove a complete recovery is impossible.';
 return {sourceVersion:source.version,assumptions,scene:{depot:state.depot,drivers:state.drivers,stops:state.stops,routes:state.routes,unavailableDriverIds:blocked},plan,alternativePlans:allPlans,verification:{valid:independent.valid,hardConstraintsChecked:true,optimalityProven:false,checker:'Independent certificate validator',reason},feasibility:{availableCapacity:capacity,demand:state.stops.length,provenCapacityShortfall:shortfall},readOnly:true};
}
/** Risk ranking is not probabilistic: deterministic single-driver removal from source state. */
export function analyzeResilience(source){
 const baseline=structuredClone(source);
 // Use the original full manifest and availability; do not contaminate actual state or audit.
 const existing=baseline.unavailableDriverIds||[];
 const candidates=baseline.drivers.filter(d=>d.available&&!existing.includes(d.id));
 const rows=[];
 for(const d of candidates){
  const {state,blocked}=normalizeWhatIf(baseline,{blocked:[...existing,d.id],strategy:'priority'});
  const plan=calculateStrategies(state,[],['priority']).strategies.priority;
  const check=verifyPlan(state,plan.routes,blocked,plan.uncovered);
  if(!check.valid)throw Error(`Risk sweep failed constraint validation for ${d.id}: ${check.reason}`);
  const theoreticalCapacity=state.drivers.filter(x=>x.available&&!blocked.includes(x.id)).reduce((n,x)=>n+x.capacity,0);
  rows.push({driverId:d.id,name:d.name,affected:(source.routes[d.id]||[]).length,covered:plan.metrics.covered,uncovered:plan.metrics.uncovered,priorityUncovered:plan.metrics.priorityUncovered,addedKm:plan.metrics.addedKm,minSlack:plan.metrics.minimumSlackMinutes,capacityShortfall:Math.max(0,state.stops.length-theoreticalCapacity),proofOfOptimality:false});
 }
 rows.sort((a,b)=>b.priorityUncovered-a.priorityUncovered||b.uncovered-a.uncovered||b.affected-a.affected||b.addedKm-a.addedKm||a.driverId.localeCompare(b.driverId));
 return {sourceVersion:source.version,method:'Independent deterministic single-driver outage scenarios, evaluated with bounded priority heuristic. Not a failure probability or proof of infeasibility.',rows,readOnly:true};
}
export function twinCertificate(source,options={}){
 const simulation=runTwin(source,options);
 const base=normalizeWhatIf(source,options).state;
 const fake={...base,mode:'proposed',version:source.version,selectedStrategy:simulation.assumptions.strategy,proposal:{...simulation.plan,id:`hypothetical-v${source.version}`},audit:source.audit||[]};
 const certificate=createCertificate(fake);const check=verifyCertificate(certificate);
 if(!check.valid)throw Error(`Twin evidence did not verify: ${check.reason}`);
 return {...certificate,verification:check,counterfactual:simulation.assumptions};
}
