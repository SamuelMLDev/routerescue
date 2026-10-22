/** Uncertainty stress test, NOT an empirical likelihood of real-world on-time delivery.
 * Synthetic bounded travel-time perturbations, seeded and replayable.
 * Same manifest + seed + samples => identical result on every platform.
 */
import {travelLeg} from './travel-matrix.js';
import {verifyPlan} from './planner.js';
function generator(seed){let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
const fixed=x=>Math.round(x*1000)/10;
export function assessTravelRobustness(state,plan,{seed=20261022,samples=400,spread=0.3}={}){
 if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('Seed out of range');
 if(!Number.isInteger(samples)||samples<10||samples>2000)throw Error('Samples must be 10–2000');
 if(!Number.isFinite(spread)||spread<0||spread>0.8)throw Error('Travel-time spread must be in 0–0.8');
 const ids=state.unavailableDriverIds||[];
 const check=verifyPlan(state,plan.routes,ids,plan.uncovered||[]);
 if(!check.valid)throw Error('Cannot stress-test an invalid route plan: '+check.reason);
 const rand=generator(seed),lookup=new Map(state.stops.map(s=>[s.id,s]));
 let complete=0,totalMisses=0,lateRuns=0;const lateByStop=Object.fromEntries(state.stops.map(s=>[s.id,0]));
 for(let sample=0;sample<samples;sample++){
  const common=(rand()*2-1)*spread*0.5;
  let missed=0;
  for(const driver of state.drivers){
   const route=plan.routes[driver.id]||[];if(!route.length)continue;
   let now=driver.shiftStart??540,last=state.depot;
   for(const id of route){
    const stop=lookup.get(id);
    const noise=(rand()*2-1)*spread;
    const factor=Math.max(0,1+common+noise);
    now+=Math.ceil(travelLeg(state,last,stop).minutes*factor);
    now=Math.max(now,stop.windowStart);
    if(now>stop.windowEnd){missed++;lateByStop[id]++;}
    now+=stop.service;last=stop;
   }
   const returnFactor=Math.max(0,1+common+(rand()*2-1)*spread);
   now+=Math.ceil(travelLeg(state,last,state.depot).minutes*returnFactor);
   if(now>(driver.shiftEnd??780))missed++;
  }
  if(missed===0)complete++;else lateRuns++;
  totalMisses+=missed;
 }
 const hotspots=Object.entries(lateByStop).filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([stopId,count])=>({stopId,lateInSimulations:count,percentage:fixed(count/samples)}));
 return {seed,samples,spread,allCommitmentsMet:complete,allCommitmentsMetPercentage:fixed(complete/samples),scenariosWithAnyMiss:lateRuns,averageMissesPerSample:Math.round(totalMisses/samples*100)/100,hotspots,
  interpretation:'Synthetic stress-test frequency under uniformly perturbed trip times and shared congestion. NOT a calibrated real-world on-time probability or confidence guarantee.',
  perturbation:'Per-trip factor = max(0, 1 + shared uniform[-spread/2,+spread/2] + local uniform[-spread,+spread]); all times rounded up to whole minutes.',
  assumptions:'Static route order, no driver adaptation, fictional geography, deterministic service durations; 0 hard-constraint violations in nominal independently verified base plan.'};
}
