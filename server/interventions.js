/** Minimum-intervention search over *explicitly defined* resource levers.
 * This does not claim to find the global minimum intervention across all possible actions.
 * Analytical capacity infeasibility is a proof; failure of a bounded heuristic is not.
 * Zero writes: each alternative is computed against a private copy of the input manifest.
 */
import {normalizeWhatIf} from './twin.js';
import {calculateStrategies,verifyPlan} from './planner.js';
import {createCertificate,verifyCertificate} from './certificate.js';
import {assessTravelRobustness} from './uncertainty.js';
const allowed=(value,min,max,name)=>{if(!Number.isInteger(value)||value<min||value>max)throw Error(`${name} must be an integer from ${min} to ${max}`);return value;};
const intArray=(value,valid,name)=>{if(!Array.isArray(value)||value.some(x=>!valid.includes(x))||new Set(value).size!==value.length)throw Error(`Invalid ${name}`);return value;};
const round=x=>Math.round(x*10)/10;
export function interventionSearch(source,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['blocked','strategy','allowWindowFlex','maxBackupCapacity','budget','windowChoices'].includes(k)))throw Error('Unknown intervention search option');
 const blocked=options.blocked??source.unavailableDriverIds??[];
 if(!Array.isArray(blocked)||blocked.some(x=>typeof x!=='string'))throw Error('Invalid unavailable volunteer list');
 const strategy=options.strategy??'priority';
 if(!['distance','balanced','priority'].includes(strategy))throw Error('Unsupported planning strategy');
 const allowWindowFlex=options.allowWindowFlex===true;
 if(options.allowWindowFlex!==undefined&&typeof options.allowWindowFlex!=='boolean')throw Error('Window flexibility flag must be boolean');
 const maxBackupCapacity=allowed(options.maxBackupCapacity??16,0,16,'Maximum backup capacity');
 const budget=allowed(options.budget??8,1,24,'Search budget');
 const windowChoices=allowWindowFlex?intArray(options.windowChoices??[0,15,30,60],[0,15,30,45,60,90,120],'window choices').sort((a,b)=>a-b):[0];
 if(!windowChoices.includes(0))windowChoices.unshift(0);
 const snapshot=normalizeWhatIf(source,{blocked,strategy});
 const capacity=snapshot.state.drivers.filter(d=>d.available&&!blocked.includes(d.id)).reduce((x,d)=>x+d.capacity,0);
 const lowerBound=Math.max(0,snapshot.state.stops.length-capacity);
 const candidates=[];
 // Intervention units are illustrative decision weights, not cash or real costs.
 for(let backup=0;backup<=maxBackupCapacity;backup++)for(const extension of windowChoices){
  // Count every extra driver as a fixed mobilisation, plus per-stop capacity and schedule flexibility.
  const resourceUnits=(backup>0?12:0)+backup*3+extension/15*11;
  candidates.push({backupCapacity:backup,extendWindows:extension,resourceUnits});
 }
 candidates.sort((a,b)=>a.resourceUnits-b.resourceUnits||a.backupCapacity-b.backupCapacity||a.extendWindows-b.extendWindows);
 let evaluated=0,analyticalPrunes=0;const rows=[];let winner=null;
 for(const choice of candidates){
  if(winner&&choice.resourceUnits>winner.resourceUnits)break;
  if(choice.backupCapacity<lowerBound){analyticalPrunes++;continue;}
  if(evaluated>=budget)break;
  evaluated++;
  const {state}=normalizeWhatIf(source,{blocked,strategy,backupCapacity:choice.backupCapacity,extendWindows:choice.extendWindows});
  let plan;
  if(!blocked.length){
   // An undisrupted schedule need not be optimised to establish full coverage.
   const unchanged=verifyPlan(state,state.routes,[],[]);
   if(!unchanged.valid)throw Error(`Undisrupted baseline is invalid: ${unchanged.reason}`);
   const priority=state.stops.filter(s=>s.priority==='Priority').length;
   plan={routes:state.routes,uncovered:[],metrics:{total:state.stops.length,covered:state.stops.length,uncovered:0,priorityProtected:priority,priorityTotal:priority,violations:0,totalKm:unchanged.km,minimumSlackMinutes:unchanged.minSlack}};
  }else plan=calculateStrategies(state,[],[strategy],true).strategies[strategy];
  const check=verifyPlan(state,plan.routes,blocked,plan.uncovered);
  if(!check.valid)throw Error(`Route validator rejected intervention: ${check.reason}`);
  const doc=createCertificate({...state,mode:'proposed',selectedStrategy:strategy,proposal:{id:'intervention-preview',...plan}});
  const independent=verifyCertificate(doc);
  if(!independent.valid)throw Error(`Independent intervention verifier rejected result: ${independent.reason}`);
  const full=plan.uncovered.length===0;
  const row={...choice,covered:plan.metrics.covered,total:plan.metrics.total,priorityProtected:plan.metrics.priorityProtected,uncovered:plan.uncovered.length,km:plan.metrics.totalKm,verified:true,status:full?'complete':'partial',certificateSha256:doc.sha256};
  rows.push(row);
  if(full&&(!winner||row.resourceUnits<winner.resourceUnits||row.resourceUnits===winner.resourceUnits&&row.km<winner.km)){
   winner={...row,plan:{routes:plan.routes,uncovered:plan.uncovered,metrics:plan.metrics},scene:{depot:state.depot,drivers:state.drivers,stops:state.stops,routes:state.routes,unavailableDriverIds:blocked},evidence:doc,robustness:assessTravelRobustness(state,plan,{samples:400,spread:0.3})};
  }
 }
 const proof=winner&&winner.backupCapacity===lowerBound&&winner.extendWindows===0&&lowerBound>0?{
  kind:'capacity_lower_bound',proven:true,
  claim:`At least ${lowerBound} additional driver-stop slots are mathematically necessary, and a ${lowerBound}-slot intervention has an independently verified full-cover plan. Minimum additional stop capacity is therefore proven for this scenario and intervention model.`
 }:null;
 return {sourceVersion:source.version,assumptions:{blocked,strategy,maxBackupCapacity,allowWindowFlex,windowChoices,budget,resourceScore:'12 mobilisation units for any backup + 3 units per added stop + 11 units per 15 minutes of blanket window extension (illustrative; not currency)'},
  capacityBound:{baselineDriverSlots:capacity,deliveries:snapshot.state.stops.length,minimumExtraStopSlots:lowerBound},
  proof, winner,alternatives:rows.filter(r=>!winner||r.backupCapacity!==winner.backupCapacity||r.extendWindows!==winner.extendWindows).slice(0,8),
  search:{evaluated,analyticallyPruned:analyticalPrunes,totalEnumerated:candidates.length,fullyExplored:evaluated+analyticalPrunes===candidates.length||Boolean(winner)&&candidates.every(c=>c.resourceUnits>winner.resourceUnits||c.backupCapacity<lowerBound||rows.some(r=>r.backupCapacity===c.backupCapacity&&r.extendWindows===c.extendWindows)),
   limitation:'Best verified candidate found under the specified finite interventions, priority strategy, and bounded heuristic. A partial heuristic result is never proof of infeasibility. Resource weights are illustrative.'},
  readOnly:true};
}
