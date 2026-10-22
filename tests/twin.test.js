import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {normalizeWhatIf,runTwin,analyzeResilience,twinCertificate} from '../server/twin.js';
import {verifyCertificate} from '../server/certificate.js';
import {verifyPlan,calculateStrategies} from '../server/planner.js';
const fixture=()=>JSON.parse(readFileSync(new URL('../seed/incident-lab.json',import.meta.url)));
const lite=()=>JSON.parse(readFileSync(new URL('../seed/demo.json',import.meta.url)));
test('read-only simulated cascade preserves every byte of the original operational state',()=>{
 const original=fixture();const before=JSON.stringify(original);const answer=runTwin(original,{blocked:['sam','priya']});
 assert.equal(JSON.stringify(original),before);assert.equal(answer.readOnly,true);assert.equal(answer.plan.metrics.covered,40);
 assert.equal(answer.verification.checker,'Independent certificate validator');
});
test('capacity crisis contains a strict lower bound and uncovered deliveries, not imaginary coverage',()=>{
 const output=runTwin(fixture(),{blocked:['sam','priya','leo','maya'],strategy:'priority'});
 assert.equal(output.feasibility.provenCapacityShortfall,8);assert.equal(output.plan.metrics.covered,32);
 assert.equal(output.plan.uncovered.length,8);assert.equal(output.verification.valid,true);
});
test('extra hypothetical capacity restores feasible full assignment without changing roster',()=>{
 const original=fixture();const answer=runTwin(original,{blocked:['sam','priya','leo','maya'],backupCapacity:8,strategy:'priority'});
 assert.equal(answer.plan.metrics.covered,40);assert.equal(answer.scene.drivers.at(-1).id,'backup');
 assert.equal(original.drivers.length,8);assert.equal(original.routes.backup,undefined);
});
test('a sudden shorter shift releases and reassigns affected routes without dropping deliveries',()=>{
 const answer=runTwin(fixture(),{blocked:[],shiftChanges:{priya:600},strategy:'priority'});
 assert.equal(answer.verification.valid,true);assert.equal(answer.scene.drivers.find(x=>x.id==='priya').shiftEnd,600);
 assert.equal(verifyPlan({...answer.scene,mode:'normal'},answer.plan.routes,[],answer.plan.uncovered).valid,true);
});
test('a locked appointment cannot be moved onto another driver when the owner is out',()=>{
 const original=lite();const locked=original.routes.sam[0];original.stops.find(x=>x.id===locked).lockedDriver='sam';
 const options=calculateStrategies(original,['sam'],['priority']);const p=options.strategies.priority;
 assert.ok(p.uncovered.includes(locked));assert.equal(verifyPlan(original,p.routes,['sam'],p.uncovered).valid,true);
});
test('counterfactual certificate uses separate checker; edits are detected, even after recomputing SHA',()=>{
 const certificate=twinCertificate(fixture(),{blocked:['sam','priya']});assert.equal(verifyCertificate(certificate).valid,true);
 const altered=structuredClone(certificate);altered.payload.proposedRoutes.sam=['N01'];
 assert.equal(verifyCertificate(altered).valid,false);
});
test('invalid scenario input is rejected before planning, without prototype surprises',()=>{
 const source=fixture();
 for(const invalid of [{blocked:['evil']},{blocked:['sam','sam']},{backupCapacity:99},{extendWindows:-1},{shiftChanges:{evil:650}},{shiftChanges:{sam:'oops'}},{strategy:'magic'}, {'__proto__':'unsafe',unknown:5}]){
  assert.throws(()=>normalizeWhatIf(source,invalid));
 }
});
test('risk sweep compares each active volunteer outage and preserves the live manifest',()=>{
 const source=lite(),before=JSON.stringify(source);const report=analyzeResilience(source);
 assert.equal(report.rows.length,source.drivers.length);assert.ok(report.rows.every(x=>x.covered+x.uncovered===source.stops.length));
 assert.equal(JSON.stringify(source),before);assert.ok(report.method.toLowerCase().includes('not'));
});

test('independent optimiser and certificate reject hidden phantom-driver routes even after rehashing',()=>{
 const source=fixture(), plan=runTwin(source,{blocked:['sam']}).plan;
 const forgedRoutes=structuredClone(plan.routes);forgedRoutes.imaginary=['N99'];
 assert.match(verifyPlan(source,forgedRoutes,['sam'],plan.uncovered).reason,/phantom/);
 const document=twinCertificate(source,{blocked:['sam']});document.payload.proposedRoutes.imaginary=[];document.sha256=createHash('sha256').update(JSON.stringify(document.payload)).digest('hex');
 assert.match(verifyCertificate(document).reason,/phantom/);
 assert.equal(verifyCertificate(document).valid,false);
});
