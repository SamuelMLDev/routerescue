import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';
const dir=mkdtempSync(path.join(os.tmpdir(),'rr-staging-'));
process.env.ROUTERESCUE_DATA_FILE=path.join(dir,'state.json');
const store=await import('../server/store.js');
test('unacknowledged, stale or unagreed hypothetical facts cannot become operational',()=>{
 const initial=store.reset(true);const args={expectedVersion:initial.version,options:{blocked:['sam'],backupCapacity:8}};
 assert.throws(()=>store.stageCounterfactual({...args,acknowledged:false}),/confirmation/);
 assert.throws(()=>store.stageCounterfactual({...args,expectedVersion:initial.version+1,acknowledged:true}),/changed/);
 assert.throws(()=>store.stageCounterfactual({...args,options:{blocked:['sam'],extendWindows:30},acknowledged:true}),/recipient agreements/);
 assert.equal(store.state().version,initial.version);
 assert.deepEqual(store.state().unavailableDriverIds,[]);
});
test('hypothetical backup is not an assignment; exact human-bound authorisation is still required',()=>{
 const original=store.state();const promoted=store.stageCounterfactual({expectedVersion:original.version,options:{blocked:['sam','priya','leo','maya'],backupCapacity:8,strategy:'priority'},acknowledged:true});
 assert.equal(promoted.mode,'normal');assert.equal(promoted.drivers.length,9);assert.equal(promoted.routes.backup.length,0);
 assert.throws(()=>store.stageCounterfactual({expectedVersion:promoted.version,options:{blocked:['sam'],backupCapacity:8},acknowledged:true}),/already registered/);
 const proposed=store.generatePlans();assert.equal(proposed.proposal.metrics.covered,40);
 assert.throws(()=>store.commit(proposed.proposal.id,'unauthorised'),/Approval/);
 const reviewed=store.authoriseApproval({proposalId:proposed.proposal.id,expectedVersion:proposed.state.version});
 const committed=store.commit(proposed.proposal.id,reviewed.token);assert.equal(committed.mode,'committed');assert.ok(committed.routes.backup.length>0);
 assert.throws(()=>store.commit(proposed.proposal.id,reviewed.token),/Approval/);
});
test('rollback reconstructs the true pre-incident roster, without ghost relief driver',()=>{
 const current=store.state();const authorisation=store.authoriseRollback(current.version);
 const restored=store.undo(authorisation.token);assert.equal(restored.mode,'normal');
 assert.equal(restored.drivers.length,8);assert.equal(restored.routes.backup,undefined);
 assert.equal(restored.unavailableDriverIds.length,0);assert.equal(restored.drivers.every(d=>d.available),true);
 assert.equal(restored.routes.sam.length,5);assert.equal(restored.baseline,null);
 assert.ok(store.verifyAudit().valid);
 assert.throws(()=>store.undo(authorisation.token),/No committed/);
});
test('shift change also restores original shift and routes on rollback',()=>{
 const baseline=store.reset(true),old=baseline.drivers.find(x=>x.id==='priya').shiftEnd;
 store.setDriverShift('priya',540);
 const plan=store.generatePlans();assert.equal(plan.proposal.metrics.covered,40);
 const auth=store.authoriseApproval({proposalId:plan.proposal.id,expectedVersion:plan.state.version});
 const committed=store.commit(plan.proposal.id,auth.token);const undo=store.authoriseRollback(committed.version);
 const restored=store.undo(undo.token);assert.equal(restored.drivers.find(x=>x.id==='priya').shiftEnd,old);
 assert.deepEqual(restored.routes,baseline.routes);
 rmSync(dir,{recursive:true,force:true});
});
