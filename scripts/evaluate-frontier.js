/** Reproducible evaluation with exact micro-oracle and stress-test reproducibility.
 * Never treats heuristic partial coverage as mathematical infeasibility.
 */
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {exactSmallRouteOptimum} from '../server/oracle.js';
import {calculateStrategies,verifyPlan} from '../server/planner.js';
import {interventionSearch} from '../server/interventions.js';
const micro=[];
for(let variant=0;variant<24;variant++){
 const depot={x:50,y:50},stops=Array.from({length:6},(_,i)=>({id:`s${i}`,x:15+((i*23+variant*7)%70),y:20+((i*13+variant*11)%60),priority:i%3?'Standard':'Priority',load:1,service:5,windowStart:540,windowEnd:840}));
 const drivers=[{id:'offline',name:'Unavailable',available:true,capacity:6,shiftStart:540,shiftEnd:900},{id:'a',name:'A',available:true,capacity:4,shiftStart:540,shiftEnd:900},{id:'b',name:'B',available:true,capacity:4,shiftStart:540,shiftEnd:900}];
 const state={depot,stops,drivers,routes:{offline:stops.map(x=>x.id),a:[],b:[]},unavailableDriverIds:['offline'],mode:'normal'};
 const start=performance.now(),optimum=exactSmallRouteOptimum(state,['offline']),exactMs=performance.now()-start;
 const heur=calculateStrategies(state,[],['distance']).strategies.distance;
 const verified=verifyPlan(state,heur.routes,['offline'],heur.uncovered);
 if(!verified.valid||!optimum.feasible||heur.uncovered.length)throw Error(`Variant ${variant}: failed benchmark`);
 micro.push({seed:variant,exactKm:optimum.minimumKm,heuristicKm:heur.metrics.totalKm,ratio:Math.round(heur.metrics.totalKm/optimum.minimumKm*1000)/1000,exactMs:Math.round(exactMs),valid:true});
}
const big=JSON.parse(fs.readFileSync(new URL('../seed/incident-lab.json',import.meta.url)));
const start=performance.now();const recovery=interventionSearch(big,{blocked:['sam','priya','leo','maya']});const interventionMs=Math.round(performance.now()-start);
const evidence={title:'RouteRescue Frontier controlled benchmark',source:'Seeded synthetic scenarios; local machine; no road traffic or human-participant data',date:new Date().toISOString(),
 micro:{count:micro.length,meanRatio:Math.round(micro.reduce((a,x)=>a+x.ratio,0)/micro.length*1000)/1000,worstRatio:Math.max(...micro.map(x=>x.ratio)),instances:micro},
 intervention:{scenario:'40 stops / four missing volunteers',minimumSlotsLowerBound:recovery.capacityBound.minimumExtraStopSlots,verifiedBackupCapacity:recovery.winner.backupCapacity,proof:recovery.proof?.claim,solverMs:interventionMs,robustness:recovery.winner.robustness},
 limitations:'Exact optimality applies only to tiny six-stop problems. Intervention proof is only minimum additional stop slots for this synthetic input and the supplied intervention model. Synthetic uncertainty is NOT an estimate of real-world on-time probabilities.'};
fs.mkdirSync('benchmarks',{recursive:true});fs.writeFileSync('benchmarks/frontier-results.json',JSON.stringify(evidence,null,2)+'\n');
console.log(`FRONTIER EVIDENCE: ${micro.length} exact cases; mean ratio ${evidence.micro.meanRatio}; worst ${evidence.micro.worstRatio}; capacity lower bound ${recovery.proof?.proven?'PROVEN':'not proven'}; synthetic uncertainty ${recovery.winner.robustness.allCommitmentsMetPercentage}%`);
