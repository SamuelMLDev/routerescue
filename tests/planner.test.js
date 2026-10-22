import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateStrategies,verifyPlan,routeSimulation,STRATEGIES} from '../server/planner.js';
const scenario=JSON.parse(fs.readFileSync(new URL('../seed/incident-lab.json',import.meta.url),'utf8'));
const lite=JSON.parse(fs.readFileSync(new URL('../seed/demo.json',import.meta.url),'utf8'));
test('40-stop seed and 16-stop original both satisfy actual hard constraints',()=>{
 for(const s of [scenario,lite]){const v=verifyPlan(s,s.routes,[]);assert.equal(v.valid,true,v.reason);assert.equal(Object.values(s.routes).flat().length,s.stops.length);}
});
test('multi-incident rescue produces three independently verified alternatives',()=>{
 const result=calculateStrategies(scenario,['sam','priya']);assert.deepEqual(result.blocked,['priya','sam']);
 for(const strategy of STRATEGIES){const p=result.strategies[strategy];assert.equal(p.metrics.covered,40);assert.equal(p.metrics.violations,0);assert.equal(p.uncovered.length,0);assert.equal(p.routes.sam.length,0);assert.equal(p.routes.priya.length,0);assert.equal(verifyPlan(scenario,p.routes,['sam','priya'],p.uncovered).valid,true);}
 assert.notDeepEqual(result.strategies.distance.routes,result.strategies.balanced.routes,'Trade-off policies should yield distinct route assignments');
});
test('capacity crisis is detected without inventing success, priority parcels survive',()=>{
 const blocked=['sam','priya','leo','maya'];const p=calculateStrategies(scenario,blocked).strategies.priority;
 assert.equal(p.metrics.covered,32);assert.equal(p.uncovered.length,8);assert.equal(p.metrics.priorityUncovered,0);assert.equal(verifyPlan(scenario,p.routes,blocked,p.uncovered).valid,true);
});
test('planner is deterministic independent of system time',()=>{
 const a=calculateStrategies(lite,['sam','priya']);const b=calculateStrategies(lite,['sam','priya']);for(const k of STRATEGIES)assert.deepEqual(a.strategies[k].routes,b.strategies[k].routes);
});
test('partial solutions cannot hide duplicates or drop stops from coverage accounting',()=>{
 const broken=structuredClone(scenario.routes);broken.sam.push(broken.priya[0]);assert.match(verifyPlan(scenario,broken,[]).reason,/Duplicate|capacity/);
 const missing=structuredClone(scenario.routes);missing.sam.pop();assert.match(verifyPlan(scenario,missing,[]).reason,/Not every/);
});
test('driver shift, volume, skills and deadline restrictions remain hard',()=>{
 const s=structuredClone(lite);const sam=s.drivers[0];sam.shiftEnd=550;assert.equal(routeSimulation(s,s.routes.sam,sam).valid,false);
 sam.shiftEnd=810;sam.maxLoad=1;assert.equal(routeSimulation(s,s.routes.sam,sam).valid,false);
 sam.maxLoad=6;s.stops.find(x=>x.id==='N01').requires='refrigerated';assert.equal(routeSimulation(s,s.routes.sam,sam).valid,false);
 sam.skills=['refrigerated'];assert.equal(routeSimulation(s,s.routes.sam,sam).valid,true);
});
test('simulated plan returns correct number of delivery events',()=>{const d=scenario.drivers[0];const r=routeSimulation(scenario,scenario.routes.sam,d);assert.ok(r.valid);assert.equal(r.schedule.length,5);assert.ok(r.schedule.every(e=>e.slack>=0));});
