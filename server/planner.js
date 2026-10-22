/**
 * Deterministic multi-objective vehicle-routing recovery engine.
 * This is a feasibility-preserving multi-start heuristic, NOT an optimality solver.
 * Hard constraints are independent of objective weights. No network/geocoding.
 */
import {distance, travelMinutes} from './solver.js';
import {travelLeg} from './travel-matrix.js';
export const STRATEGIES = Object.freeze(['distance','balanced','priority']);
export const STRATEGY_META = Object.freeze({
 distance:{label:'Shortest routes',description:'Minimise total estimated driving distance after covering stops.'},
 balanced:{label:'Fair workload',description:'Distribute route burden and reduce driver overload.'},
 priority:{label:'Protect priority',description:'Protect priority doorstep commitments before optional savings.'}
});
const round=n=>Math.round(n*10)/10;
const blockedIds=(state,extra=[])=>[...new Set([...(state.unavailableDriverIds||[]),...extra])].sort();
export function routeSimulation(state,ids,driver){
 const index=new Map(state.stops.map(s=>[s.id,s]));
 const start=driver.shiftStart??540,end=driver.shiftEnd??780;
 if(ids.length>driver.capacity)return {valid:false,reason:`${driver.name} exceeds capacity (${ids.length}/${driver.capacity})`};
 let now=start,last=state.depot,km=0,load=0,minSlack=Infinity;
 const schedule=[];
 for(const id of ids){
  const stop=index.get(id);
  if(!stop)return {valid:false,reason:`Unknown stop ${id}`};
  load+=stop.load??1;
  if(load>(driver.maxLoad??driver.capacity))return {valid:false,reason:`${driver.name} exceeds parcel capacity`};
  if(stop.lockedDriver&&stop.lockedDriver!==driver.id)return {valid:false,reason:`${id} is locked to ${stop.lockedDriver}`};
  if(stop.requires&&!(driver.skills||[]).includes(stop.requires))return {valid:false,reason:`${driver.name} cannot serve ${id} (${stop.requires})`};
  const leg=travelLeg(state,last,stop);km+=leg.km;const reached=now+leg.minutes;
  const arrival=Math.max(reached,stop.windowStart),slack=stop.windowEnd-arrival;
  if(slack<0)return {valid:false,reason:`${id} misses its latest delivery window`};
  minSlack=Math.min(minSlack,slack);
  now=arrival+stop.service;
  schedule.push({stopId:id,arrival,departure:now,slack,wait:arrival-reached});last=stop;
 }
 const home=travelLeg(state,last,state.depot);km+=home.km;const finish=now+home.minutes;
 if(finish>end)return {valid:false,reason:`${driver.name} cannot return before end of shift`};
 return {valid:true,km:round(km),rawKm:km,minutes:finish-start,finish,load,slack:Number.isFinite(minSlack)?minSlack:null,schedule};
}
export function verifyPlan(state,routes,unavailable=[],uncovered=[]){
 const knownDrivers=new Set(state.drivers.map(d=>d.id));
 if(Object.keys(routes).some(id=>!knownDrivers.has(id)))return {valid:false,reason:'Route contains unknown or phantom driver'};
 const blocked=new Set(blockedIds(state,unavailable));
 const stops=new Set(state.stops.map(s=>s.id));
 const assigned=new Set();const routeInfo={};let km=0,work=0,minSlack=Infinity;
 for(const driver of state.drivers){
  const ids=routes[driver.id];
  if(!Array.isArray(ids))return {valid:false,reason:`Missing route for ${driver.id}`};
  if((blocked.has(driver.id)||!driver.available)&&ids.length)return {valid:false,reason:`Unavailable driver ${driver.id} still has assigned stops`};
  for(const id of ids){if(!stops.has(id))return {valid:false,reason:`Unknown stop ${id}`};if(assigned.has(id))return {valid:false,reason:`Duplicate stop ${id}`};assigned.add(id);}
  const info=routeSimulation(state,ids,driver);
  if(!info.valid)return {valid:false,reason:info.reason};
  routeInfo[driver.id]=info;
  if(ids.length){km+=info.rawKm;work+=info.minutes;minSlack=Math.min(minSlack,info.slack??Infinity);}
 }
 for(const id of uncovered){if(!stops.has(id)||assigned.has(id))return {valid:false,reason:`Invalid uncovered stop ${id}`};assigned.add(id);}
 if(assigned.size!==stops.size)return {valid:false,reason:'Not every stop is assigned or explicitly uncovered'};
 return {valid:true,km:round(km),totalMinutes:work,minSlack:Number.isFinite(minSlack)?minSlack:null,routeInfo};
}
function routeLoadValue(sim){return sim.minutes;}
function routeScore(state,routes,available,strategy,cache){
 const v=available.map(d=>getSim(state,routes[d.id],d,cache));
 if(v.some(x=>!x.valid))return Infinity;
 const km=v.reduce((n,x)=>n+x.rawKm,0);
 const times=v.map((x,i)=>routes[available[i].id].length?routeLoadValue(x):0);
 const avg=times.reduce((a,b)=>a+b,0)/(times.length||1);
 const dispersion=times.reduce((sum,n)=>sum+(n-avg)**2,0)/Math.max(1,times.length);
 const stopCounts=available.map(d=>routes[d.id].length);
 const avgStops=stopCounts.reduce((a,b)=>a+b,0)/Math.max(1,available.length);
 const stopVariance=stopCounts.reduce((a,b)=>a+(b-avgStops)**2,0)/Math.max(1,available.length);
 const balance=(Math.sqrt(dispersion)*0.3)+(stopVariance*9);
 const weight=strategy==='balanced'?3.1:strategy==='priority'?0.45:0;
 return km+weight*balance;
}
function getSim(state,ids,driver,cache){
 const key=`${driver.id}:${ids.join(',')}`;
 let result=cache.get(key);
 if(!result){result=routeSimulation(state,ids,driver);cache.set(key,result);}
 return result;
}
function initialOrder(state,pool,mode){
 const stop=new Map(state.stops.map(s=>[s.id,s]));
 const keys={
  urgent:id=>[stop.get(id).priority==='Priority'?0:1,stop.get(id).windowEnd, id],
  deadline:id=>[stop.get(id).windowEnd,stop.get(id).priority==='Priority'?0:1,id],
  far:id=>[-distance(state.depot,stop.get(id)),stop.get(id).windowEnd,id],
  nearest:id=>[distance(state.depot,stop.get(id)),stop.get(id).windowEnd,id],
  reversed:id=>[-stop.get(id).windowEnd,stop.get(id).priority==='Priority'?0:1,id]
 };
 const keyof=keys[mode];return [...pool].sort((a,b)=>{const aa=keyof(a),bb=keyof(b);for(let i=0;i<aa.length;i++){if(aa[i]<bb[i])return -1;if(aa[i]>bb[i])return 1;}return 0;});
}
function placements(state,routes,available,id,strategy,cache,limit=4){
 const proposals=[];
 for(const driver of available){
  const current=routes[driver.id],baseline=getSim(state,current,driver,cache);
  if(current.length>=driver.capacity)continue;
  for(let pos=0;pos<=current.length;pos++){
   const trial=[...current.slice(0,pos),id,...current.slice(pos)];
   const sim=getSim(state,trial,driver,cache);
   if(!sim.valid)continue;
   const increment=sim.rawKm-baseline.rawKm;
   const overload=(trial.length/driver.capacity)**2;
   const urgency=state.stops.find(s=>s.id===id).priority==='Priority';
   const value=increment+(strategy==='balanced'?overload*15+Math.pow(sim.minutes/50,2)*0.75:strategy==='priority'?overload*1.5:0)
      +(urgency?Math.max(0,10-(sim.slack??100))*0.03:0);
   proposals.push({driverId:driver.id,pos,value,increment});
  }
 }
 proposals.sort((a,b)=>a.value-b.value||a.increment-b.increment||a.driverId.localeCompare(b.driverId)||a.pos-b.pos);
 return proposals.slice(0,limit);
}
function insert(routes,p,id){routes[p.driverId].splice(p.pos,0,id);}
function refine(state,routes,available,strategy,cache){
 // Relocate assigned stops only if globally feasible and the weighted objective improves.
 for(let pass=0;pass<3;pass++){
  let best=null;
  const baseline=routeScore(state,routes,available,strategy,cache);
  for(const from of available){for(let a=0;a<routes[from.id].length;a++){
   const stopId=routes[from.id][a];
   for(const to of available){
    const shortened=routes[from.id].filter((_,i)=>i!==a);
    if(!getSim(state,shortened,from,cache).valid)continue;
    for(let b=0;b<routes[to.id].length+(to.id===from.id?0:1);b++){
     if(from.id===to.id&&b===a)continue;
     const next=structuredClone(routes);
     next[from.id].splice(a,1);
     next[to.id].splice(b,0,stopId);
     if(!getSim(state,next[to.id],to,cache).valid)continue;
     const score=routeScore(state,next,available,strategy,cache);
     if(score<baseline-0.04&&(!best||score<best.score-0.001))best={routes:next,score};
    }
   }
  }}
  if(!best)break;
  Object.assign(routes,best.routes);
 }
}
function buildCandidate(state,blocked,strategy,orderMode){
 const unavailable=new Set(blocked),available=state.drivers.filter(d=>d.available&&!unavailable.has(d.id));
 // An available driver may acquire a shorter shift in a what-if scenario.
 // Release *all* stops on a newly infeasible route to the common insertion pool.
 const released=new Set(state.drivers.filter(d=>!unavailable.has(d.id)&&d.available&&!routeSimulation(state,state.routes[d.id]||[],d).valid).map(d=>d.id));
 const routes=Object.fromEntries(state.drivers.map(d=>[d.id,unavailable.has(d.id)||released.has(d.id)?[]:[...(state.routes[d.id]||[])]]));
 const pool=state.drivers.filter(d=>unavailable.has(d.id)||released.has(d.id)).flatMap(d=>state.routes[d.id]||[]);
 const uncovered=[],cache=new Map();
 for(const id of initialOrder(state,pool,orderMode)){
  const best=placements(state,routes,available,id,strategy,cache,1)[0];
  if(best)insert(routes,best,id);else uncovered.push(id);
 }
 // Limited one-level ejection chain: exchange an assigned stop to make room for an urgent uncovered one.
 for(const id of [...uncovered]){
  let repaired=false;
  for(const target of available){
   for(let i=0;i<routes[target.id].length&&!repaired;i++){
    const replaced=routes[target.id][i];
    const next=structuredClone(routes);next[target.id].splice(i,1);
    const choices=placements(state,next,available,id,strategy,cache,2);
    for(const p of choices){
     const candidate=structuredClone(next);insert(candidate,p,id);
     const second=placements(state,candidate,available,replaced,strategy,cache,1)[0];
     if(second){insert(candidate,second,replaced);Object.assign(routes,candidate);uncovered.splice(uncovered.indexOf(id),1);repaired=true;break;}
    }
   }
   if(repaired)break;
  }
 }
 refine(state,routes,available,strategy,cache);
 const integrity=verifyPlan(state,routes,blocked,uncovered);
 if(!integrity.valid)throw Error(`Planner invariant failed: ${integrity.reason}`);
 return {routes,uncovered,integrity,score:routeScore(state,routes,available,strategy,cache)};
}
/** Deterministic bounded large-neighbourhood search. The same route simulator checks
 * every insertion. It is an improvement step, never a substitute for verification.
 * Focus on full, feasible plans; unresolved coverage is preserved and surfaced.
 */
function largeNeighbourhoodImprove(state,incumbent,blocked,strategy,{rounds=7}={}){
 const available=state.drivers.filter(d=>d.available&&!blocked.includes(d.id));
 if(available.length===0)return incumbent;
 let best=incumbent,bestScore=routeScore(state,best.routes,available,strategy,new Map());
 const all=state.stops.map(s=>s.id);
 for(let round=0;round<rounds;round++){
  const routes=structuredClone(best.routes),cache=new Map();
  const assigned=all.filter(id=>available.some(d=>routes[d.id].includes(id)));
  if(!assigned.length)break;
  // Reproducible perturbations: contiguous-route removal alternates with geographically clustered removal.
  let remove;
  if(round%2===0){
   const focal=assigned[(round*17+5)%assigned.length];const focus=state.stops.find(s=>s.id===focal);
   remove=[...assigned].sort((a,b)=>distance(state.stops.find(s=>s.id===a),focus)-distance(state.stops.find(s=>s.id===b),focus)||a.localeCompare(b)).slice(0,Math.min(3,assigned.length));
  }else{
   const d=available[round%available.length];const ids=routes[d.id];
   remove=ids.slice(Math.max(0,Math.floor(ids.length/2)-1),Math.max(0,Math.floor(ids.length/2)-1)+3);
  }
  if(!remove.length)continue;
  for(const id of remove){for(const d of available){const at=routes[d.id].indexOf(id);if(at>=0)routes[d.id].splice(at,1);}}
  const pool=[...new Set([...remove,...best.uncovered])];
  const ordered=initialOrder(state,pool,round%3===0?'urgent':round%3===1?'deadline':'far');
  const unassigned=[];
  for(const id of ordered){const p=placements(state,routes,available,id,strategy,cache,1)[0];if(p)insert(routes,p,id);else unassigned.push(id);}
  // Preserve full accounting. Lexicographic: urgent missing, total missing, objective score.
  const valid=verifyPlan(state,routes,blocked,unassigned);if(!valid.valid)throw Error('LNS produced invalid route: '+valid.reason);
  const missedPriority=unassigned.filter(id=>state.stops.find(s=>s.id===id)?.priority==='Priority').length;
  const oldMissedPriority=best.uncovered.filter(id=>state.stops.find(s=>s.id===id)?.priority==='Priority').length;
  const score=routeScore(state,routes,available,strategy,cache);
  if(missedPriority<oldMissedPriority||missedPriority===oldMissedPriority&&(unassigned.length<best.uncovered.length||unassigned.length===best.uncovered.length&&score<bestScore-.001)){
   best={routes,uncovered:unassigned,integrity:valid,score};bestScore=score;
  }
 }
 return best;
}
function metrics(state,solution,blocked){
 const originalOwner=Object.fromEntries(Object.entries(state.routes).flatMap(([driver,ids])=>ids.map(id=>[id,driver])));
 const nextOwner=Object.fromEntries(Object.entries(solution.routes).flatMap(([driver,ids])=>ids.map(id=>[id,driver])));
 const moved=state.stops.filter(s=>originalOwner[s.id]!==nextOwner[s.id]&&nextOwner[s.id]).map(s=>({stopId:s.id,from:originalOwner[s.id],to:nextOwner[s.id]}));
 const available=state.drivers.filter(d=>d.available&&!blocked.includes(d.id));
 const previousAvailableKm=available.reduce((n,d)=>{const old=routeSimulation(state,state.routes[d.id]||[],d);return n+(old.valid?old.km:0);},0);
 const urgentIds=state.stops.filter(s=>s.priority==='Priority').map(s=>s.id);
 const urgentMissed=urgentIds.filter(id=>solution.uncovered.includes(id));
 const times=available.map(d=>solution.integrity.routeInfo[d.id].minutes);
 const avg=times.reduce((a,b)=>a+b,0)/(times.length||1);
 const spread=Math.round(Math.sqrt(times.reduce((a,b)=>a+(b-avg)**2,0)/(times.length||1)));
 const affected=state.drivers.filter(d=>blocked.includes(d.id)||!routeSimulation(state,state.routes[d.id]||[],d).valid).reduce((n,d)=>n+(state.routes[d.id]||[]).length,0);
 return {total:state.stops.length,covered:state.stops.length-solution.uncovered.length,uncovered:solution.uncovered.length,affected,
  drivers:available.length,priorityProtected:urgentIds.length-urgentMissed.length,priorityTotal:urgentIds.length,
  priorityUncovered:urgentMissed.length,totalKm:solution.integrity.km,addedKm:round(solution.integrity.km-previousAvailableKm),
  violations:0,workloadSpreadMinutes:spread,minimumSlackMinutes:solution.integrity.minSlack,moved:moved.length};
}
function rate(p){ // Coverage first (especially urgent), then each strategy's weighted objective.
 return p.metrics.priorityUncovered*1000000 + p.metrics.uncovered*100000 + p._score;
}
export function calculateStrategies(state,additionalUnavailable=[],onlyStrategies=STRATEGIES,allowNoOutage=false){
 const blocked=blockedIds(state,additionalUnavailable);
 if(!blocked.length&&!allowNoOutage)throw Error('Choose at least one disruption before planning');
 if(blocked.some(id=>!state.drivers.some(d=>d.id===id)))throw Error('Unknown driver in incident');
 if(state.mode==='committed')throw Error('Rollback or reset before planning new incidents');
 const result={};
 for(const strategy of onlyStrategies){
  if(!STRATEGIES.includes(strategy))throw Error("Unknown recovery strategy");
  let best=null;
  const orderModes=strategy==='priority'?['urgent','deadline','far']:['deadline','urgent','far'];
  for(const mode of orderModes){
   const candidate=buildCandidate(state,blocked,strategy,mode);
   const p={strategy,blocked,routes:candidate.routes,uncovered:candidate.uncovered,
    metrics:metrics(state,candidate,blocked),routeInfo:candidate.integrity.routeInfo,_score:candidate.score};
   if(!best||rate(p)<rate(best)-0.001)best=p;
  }
  const improved=largeNeighbourhoodImprove(state,{routes:best.routes,uncovered:best.uncovered,integrity:verifyPlan(state,best.routes,blocked,best.uncovered),score:best._score},blocked,strategy);
  if(improved.routes!==best.routes){const recomputed={routes:improved.routes,uncovered:improved.uncovered,integrity:improved.integrity,score:improved.score};best={...best,routes:improved.routes,uncovered:improved.uncovered,routeInfo:improved.integrity.routeInfo,metrics:metrics(state,recomputed,blocked),_score:improved.score};}
  const changed=state.stops.filter(s=>!best.uncovered.includes(s.id)).filter(s=>{
   const oldOwner=state.drivers.find(d=>state.routes[d.id]?.includes(s.id))?.id;
   return oldOwner!==state.drivers.find(d=>best.routes[d.id]?.includes(s.id))?.id;
  }).map(s=>({stopId:s.id,from:state.drivers.find(d=>state.routes[d.id]?.includes(s.id))?.id,to:state.drivers.find(d=>best.routes[d.id]?.includes(s.id))?.id}));
  result[strategy]={strategy,label:STRATEGY_META[strategy].label,description:STRATEGY_META[strategy].description,
   routes:best.routes,uncovered:best.uncovered,metrics:best.metrics,routeInfo:best.routeInfo,reassigned:changed,
   assertions:{hardConstraintsChecked:true,verified:true,optimalityGuaranteed:false,search:"multi-start insertion + ejection repair + relocation + deterministic LNS"},
   reasoning:[`${best.metrics.covered} of ${best.metrics.total} stops have feasible assignments`,
    `${best.metrics.priorityProtected} of ${best.metrics.priorityTotal} priority deliveries covered`,
    `Workload dispersion: ${best.metrics.workloadSpreadMinutes} minutes (standard deviation)`,
    `Closest delivery deadline margin: ${best.metrics.minimumSlackMinutes??'n/a'} minutes`]
  };
 }
 return {blocked,strategies:result};
}
