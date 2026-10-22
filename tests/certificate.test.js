import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {calculateStrategies} from '../server/planner.js';
import {createCertificate,verifyCertificate} from '../server/certificate.js';
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../seed/incident-lab.json',import.meta.url),'utf8'));
function proposal(ids){const state=fixture();state.unavailableDriverIds=ids;const p=calculateStrategies(state).strategies.balanced;state.mode='proposed';state.selectedStrategy='balanced';state.proposal={...p,id:'evidence-1'};state.audit=[];return state;}
test('independent verifier validates full synthetic cascade certificate without planner import',()=>{
 const certificate=createCertificate(proposal(['sam','priya']));const result=verifyCertificate(certificate);
 assert.equal(result.valid,true,result.reason);assert.equal(result.facts.assigned,40);assert.equal(result.facts.uncovered,0);
});
test('partial recovery evidence is truthful while commitment remains disabled',()=>{
 const certificate=createCertificate(proposal(['sam','priya','leo','maya']));const result=verifyCertificate(certificate);
 assert.equal(result.valid,true,result.reason);assert.equal(result.facts.assigned,32);assert.equal(result.facts.uncovered,8);
});
test('hash validation catches unacknowledged changes',()=>{
 const proof=createCertificate(proposal(['sam']));proof.payload.claimed.covered=0;
 assert.match(verifyCertificate(proof).reason,/hash/);
});
test('forged digest cannot hide deadline violations or duplicate assignments',()=>{
 const proof=createCertificate(proposal(['sam']));proof.payload.proposedRoutes.noah[0]=proof.payload.proposedRoutes.ella[0];
 // Re-signing is possible because the hash is not an authenticity signature.
 proof.sha256=crypto.createHash('sha256').update(JSON.stringify(proof.payload)).digest('hex');
 assert.match(verifyCertificate(proof).reason,/duplicated assignment/);
});
