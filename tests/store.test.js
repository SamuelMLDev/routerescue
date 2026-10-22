import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
const dir=mkdtempSync(path.join(os.tmpdir(),'rr-store-'));
process.env.ROUTERESCUE_DATA_FILE=path.join(dir,'state.json');
const store=await import('../server/store.js');
test('incident updates invalidate plans; a new disruption triggers fresh alternatives',()=>{
 store.reset(true);store.toggleIncident('sam');let p=store.generatePlans();assert.equal(p.state.mode,'proposed');
 store.toggleIncident('priya');assert.equal(store.state().proposal,null);assert.equal(store.state().unavailableDriverIds.length,2);
 p=store.generatePlans();assert.equal(p.proposal.metrics.covered,40);
});
test('approval token binds exact reviewed proposal, version, and is single use',()=>{
 const s=store.state(),id=s.proposal.id;
 assert.throws(()=>store.commit(id,'wrong'),/Approval/);
 assert.throws(()=>store.authoriseApproval({proposalId:'wrong',expectedVersion:s.version}),/expired/);
 const intent=store.authoriseApproval({proposalId:id,expectedVersion:s.version});
 assert.throws(()=>store.commit(id,'incorrect'),/Approval/);
 const committed=store.commit(id,intent.token);assert.equal(committed.mode,'committed');assert.equal(committed.routes.sam.length,0);
 assert.throws(()=>store.commit(id,intent.token),/Approval/);
});
test('rollback restores original routes and driver availability, not just all drivers to true',()=>{
 const before=store.state();assert.equal(before.mode,'committed');
 const rollbackToken=store.authoriseRollback(before.version);const restored=store.undo(rollbackToken.token);assert.equal(restored.mode,'normal');assert.equal(restored.routes.sam.length,5);assert.equal(restored.drivers.find(d=>d.id==='sam').available,true);
 assert.deepEqual(restored.unavailableDriverIds,[]);assert.deepEqual(restored.incidents,[]);
});
test('strategy selections invalidate unspent human approvals',()=>{
 store.toggleIncident('sam');store.generatePlans();let s=store.state(),old=s.proposal.id;
 const intent=store.authoriseApproval({proposalId:old,expectedVersion:s.version});
 store.selectStrategy('distance',s.version);assert.throws(()=>store.commit(old,intent.token),/Approval/);
});
test('audit hash chain verifies and tampering is detectable',()=>{
 assert.ok(store.verifyAudit().valid);
 const db=process.env.ROUTERESCUE_DATA_FILE,s=JSON.parse(readFileSync(db,'utf8'));s.audit[0].detail.message='tampered';
 assert.equal(store.verifyAudit(s).valid,false);
 // Restoration ensures no persistent corruption is introduced by the test.
 s.audit[0].detail.message='Incident Lab loaded: fictional 40-stop scenario';writeFileSync(db,JSON.stringify(s));assert.ok(store.verifyAudit().valid);
});
test('partial proposals reject approval rather than silently dropping deliveries',()=>{
 store.reset(true);for(const id of ['sam','priya','leo','maya'])store.toggleIncident(id);
 const p=store.generatePlans();assert.equal(p.proposal.uncovered.length,8);
 assert.throws(()=>store.authoriseApproval({proposalId:p.proposal.id,expectedVersion:p.state.version}),/Partial/);
 rmSync(dir,{recursive:true,force:true});
});
