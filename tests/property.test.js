import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {calculateStrategies,verifyPlan,STRATEGIES} from '../server/planner.js';
const base=JSON.parse(fs.readFileSync(new URL('../seed/demo.json',import.meta.url),'utf8'));
let entropy=0xA115BEEF;function random(){entropy^=entropy<<13;entropy^=entropy>>>17;entropy^=entropy<<5;return (entropy>>>0)/4294967296;}
test('30 seeded adversarial perturbations never allow a duplicate, capacity breach, unaccounted stop or late route',()=>{
 let partials=0;
 for(let i=0;i<30;i++){
  const state=structuredClone(base);
  for(const driver of state.drivers){driver.capacity=4+Math.floor(random()*4);driver.shiftEnd=780+Math.floor(random()*25);}
  for(const stop of state.stops){if(random()<.28)stop.priority='Priority';if(random()<.12)stop.windowEnd+=Math.round(random()*35);}
  const blocked=state.drivers.filter(()=>random()<.55).map(d=>d.id);
  if(!blocked.length)blocked.push('sam');
  const results=calculateStrategies(state,blocked);
  for(const key of STRATEGIES){const result=results.strategies[key];const check=verifyPlan(state,result.routes,blocked,result.uncovered);
   assert.equal(check.valid,true,`Iteration ${i} ${key}: ${check.reason}`);
   assert.equal(result.metrics.covered+result.uncovered.length,state.stops.length);
   if(result.uncovered.length)partials++;
   for(const id of blocked)assert.deepEqual(result.routes[id],[]);
  }
 }
 assert.ok(partials>0,'Test includes cases with infeasible complete coverage');
});
