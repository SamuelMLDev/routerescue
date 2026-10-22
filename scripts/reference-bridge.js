/** Isolated benchmark adapter: production solver only. Reference solver runs in Python. */
import {calculateStrategies,verifyPlan} from '../server/planner.js';
let raw='';for await (const chunk of process.stdin)raw+=chunk;
const scenarios=JSON.parse(raw);if(!Array.isArray(scenarios)||scenarios.length>500)throw Error('Invalid benchmark cases');
const output=[];
for(const state of scenarios){
 const start=performance.now();
 const blocked=state.unavailableDriverIds;
 const plan=calculateStrategies(state,[],['distance']).strategies.distance;
 const check=verifyPlan(state,plan.routes,blocked,plan.uncovered);
 if(!check.valid)throw Error('Production heuristic emitted invalid solution: '+check.reason);
 output.push({coverage:plan.metrics.covered,priorityUncovered:plan.metrics.priorityUncovered,totalKm:plan.metrics.totalKm,ms:+(performance.now()-start).toFixed(3),independentlyValidatedByProject:check.valid,uncovered:plan.uncovered});
}
process.stdout.write(JSON.stringify(output));
