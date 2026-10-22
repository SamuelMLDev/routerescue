/** Reproducible, transparent benchmark: timing is machine-dependent; no statistical win claims. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {calculateStrategies,verifyPlan,STRATEGIES} from '../server/planner.js';
import {rescue,evaluate} from '../server/solver.js';
const small=JSON.parse(readFileSync(new URL('../seed/demo.json',import.meta.url),'utf8'));
const big=JSON.parse(readFileSync(new URL('../seed/incident-lab.json',import.meta.url),'utf8'));
const results={meta:{name:'RouteRescue algorithm comparison',fixture:'fictional scenario data',method:'same deterministic seed; single process; no external API; durations depend on machine',timing:'high-resolution wall time',quality:'feasibility and plan characteristics only; not global optimality'},legacy:[],incidentLab:[]};
for(const d of small.drivers){
 const t0=performance.now(),old=rescue(small,d.id),oldMs=performance.now()-t0;
 const t1=performance.now(),newPlans=calculateStrategies(small,[d.id]),newMs=performance.now()-t1;
 const best=newPlans.strategies.distance;
 const v=verifyPlan(small,best.routes,[d.id],best.uncovered);
 if(!v.valid)throw Error('Invalid benchmark plan: '+v.reason);
 results.legacy.push({driver:d.id,affected:small.routes[d.id].length,baselineCovered:small.stops.length-old.uncovered.length,baselineKm:old.metrics.totalKm,
  baselineMs:Math.round(oldMs),newCovered:best.metrics.covered,newKm:best.metrics.totalKm,newMs:Math.round(newMs),allRoutesValid:v.valid});
}
const scenarios=[['sam'],['priya'],['leo'],['maya'],['sam','priya'],['sam','leo'],['sam','priya','leo'],['sam','priya','leo','maya']];
for(const blocked of scenarios){
 const start=performance.now(),out=calculateStrategies(big,blocked),milliseconds=Math.round(performance.now()-start);
 const plans={};for(const strategy of STRATEGIES){const p=out.strategies[strategy];const v=verifyPlan(big,p.routes,blocked,p.uncovered);
  if(!v.valid)throw Error(`${blocked.join(',')} ${strategy}: ${v.reason}`);
  plans[strategy]={covered:p.metrics.covered,priorityCovered:p.metrics.priorityProtected,uncovered:p.metrics.uncovered,km:p.metrics.totalKm,workloadSpreadMinutes:p.metrics.workloadSpreadMinutes,validated:v.valid};
 }
 results.incidentLab.push({blocked,milliseconds,plans});
}
const path='benchmarks';mkdirSync(path,{recursive:true});writeFileSync(path+'/results.json',JSON.stringify(results,null,2));
const t=['# Reproducible RouteRescue benchmark','',
 'All data is synthetic, all runs are deterministic, and durations are indicative of this machine only. There is no independent real-world delivery dataset and no global-optimality guarantee.',
 '','## Earlier single-outage heuristic versus Incident Lab strategy on the same 16-stop fixture','','| Driver unavailable | Earlier coverage | New distance coverage | Earlier route distance (km) | New route distance (km) | Earlier solver time | New three-policy time |','|---|---:|---:|---:|---:|---:|---:|',
 ...results.legacy.map(r=>`| ${r.driver} | ${r.baselineCovered}/16 | ${r.newCovered}/16 | ${r.baselineKm} | ${r.newKm} | ${r.baselineMs} ms | ${r.newMs} ms |`),
 '', 'The timings measure different workloads: the earlier heuristic produces **one** plan; the new engine produces **three** alternatives and validates them. Faster time for the earlier solver is expected. These results do not establish that one algorithm is globally superior.',
 '', '## Multi-incident reliability on the 40-stop Incident Lab fixture','', '| Unavailable drivers | Distance coverage | Balanced coverage | Priority coverage | Priority commitments covered | Three-policy total duration |','|---|---:|---:|---:|---:|---:|',
 ...results.incidentLab.map(r=>`| ${r.blocked.join(' + ')} | ${r.plans.distance.covered}/40 | ${r.plans.balanced.covered}/40 | ${r.plans.priority.covered}/40 | ${r.plans.priority.priorityCovered}/8 | ${r.milliseconds} ms |`),
 '', 'The four-driver outage has only 32 remaining driver-stop slots for 40 deliveries. All strategies report uncovered stops rather than claiming that an impossible complete assignment is feasible.',
 '', '## Reproduce','', '```sh','node scripts/benchmark.js','```','', 'The script writes `benchmarks/results.json` and this report. No network calls, keys or remote services are used.'];
writeFileSync('docs/BENCHMARK.md',t.join('\n')+'\n');
console.log('BENCHMARK COMPLETE:',results.legacy.length,'legacy comparisons,',results.incidentLab.length,'40-stop incident scenarios');
console.log('See docs/BENCHMARK.md and benchmarks/results.json');
