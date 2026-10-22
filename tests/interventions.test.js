import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {interventionSearch} from '../server/interventions.js';
import {assessTravelRobustness} from '../server/uncertainty.js';
import {verifyCertificate} from '../server/certificate.js';
import {validateAIPlan,modelReadOnlyPlan} from '../server/ai-agent.js';
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../seed/incident-lab.json',import.meta.url)));
const blocked=['sam','priya','leo','maya'];
test('bounded minimum intervention: capacity lower bound PROVES eight slots necessary and eight sufficient',()=>{
 const original=fixture(),snapshot=JSON.stringify(original);
 const r=interventionSearch(original,{blocked,budget:8,allowWindowFlex:false});
 assert.equal(r.capacityBound.minimumExtraStopSlots,8);
 assert.equal(r.winner.backupCapacity,8);
 assert.equal(r.winner.covered,40);
 assert.equal(r.proof.proven,true);
 assert.equal(r.search.analyticallyPruned,8);
 assert.equal(verifyCertificate(r.winner.evidence).valid,true);
 assert.equal(JSON.stringify(original),snapshot,'Counterfactual cannot modify source');
 assert.equal(r.winner.robustness.samples,400);
});
test('unreachable capacity cap: no fabricated recovery, only an analytical lower bound',()=>{
 const r=interventionSearch(fixture(),{blocked,maxBackupCapacity:7,budget:3});
 assert.equal(r.winner,null);
 assert.equal(r.search.evaluated,0);
 assert.equal(r.capacityBound.minimumExtraStopSlots,8);
 assert.equal(r.proof,null);
});
test('model tool plan rejects write tools, phantom drivers, invalid capacities and multiple untrusted actions',()=>{
 const drivers=fixture().drivers;
 assert.throws(()=>validateAIPlan({actions:[{tool:'commit_rescue'}]},drivers),/unsupported operation/);
 assert.throws(()=>validateAIPlan({actions:[{tool:'simulate_what_if',blockedDrivers:['phantom']}]},drivers),/unknown/);
 assert.throws(()=>validateAIPlan({actions:[{tool:'simulate_what_if',backupCapacity:99}]},drivers),/invalid backup/);
 assert.throws(()=>validateAIPlan({actions:Array.from({length:4},()=>({tool:'assess_single_failure_resilience'}))},drivers),/invalid action plan/);
 const actions=validateAIPlan({actions:[{tool:'find_minimum_intervention',blockedDrivers:blocked}]},drivers);
 assert.equal(actions[0].tool,'find_minimum_intervention');assert.equal(actions[0].args.allowWindowFlex,false);
});
test('optional AI plan uses a mock provider, enforces allowed tools, and never contacts network without a key',async()=>{
 const s=fixture();let requests=0;
 const missing=await modelReadOnlyPlan('Find smallest recovery',s,{apiKey:null,model:'mock',fetchImpl:()=>{requests++;throw Error('network was called');}});
 assert.equal(missing,null);assert.equal(requests,0);
 const mock=async()=>({ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify({actions:[{tool:'find_minimum_intervention',blockedDrivers:blocked,strategy:'priority'}]})}}]})});
 const plan=await modelReadOnlyPlan('Find the minimum',s,{apiKey:'fake',model:'test',endpoint:'http://localhost:9050/v1/chat/completions',fetchImpl:mock});
 assert.equal(plan[0].tool,'find_minimum_intervention');
 await assert.rejects(()=>modelReadOnlyPlan('Find the minimum',s,{apiKey:'fake',model:'test',endpoint:'http://example.com/v1',fetchImpl:mock}),/HTTPS/);
});
test('seeded uncertainty is repeatable, validates plan, and always labels outcomes as synthetic',()=>{
 const s=fixture();const result=interventionSearch(s,{blocked,maxBackupCapacity:8});
 const scenario={...s,unavailableDriverIds:blocked,drivers:result.winner.scene.drivers,stops:result.winner.scene.stops};
 const a=assessTravelRobustness(scenario,result.winner.plan,{samples:50,seed:2121,spread:0.5});
 const b=assessTravelRobustness(scenario,result.winner.plan,{samples:50,seed:2121,spread:0.5});
 assert.deepEqual(a,b);assert.match(a.interpretation,/NOT a calibrated/);
 assert.throws(()=>assessTravelRobustness(scenario,{...result.winner.plan,routes:{...result.winner.plan.routes,backup:['unknown']}}),/invalid route/);
});
