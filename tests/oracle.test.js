import test from 'node:test';
import assert from 'node:assert/strict';
import {exactSmallRouteOptimum} from '../server/oracle.js';
import {verifyPlan} from '../server/planner.js';
test('tiny exact oracle enumerates alternative sequences and has a feasible certificate',()=>{
 const s={depot:{x:0,y:0},stops:[{id:'one',x:8,y:0,windowStart:540,windowEnd:800,service:3},{id:'two',x:8,y:8,windowStart:540,windowEnd:800,service:3},{id:'three',x:0,y:8,windowStart:540,windowEnd:800,service:3}],drivers:[{id:'a',name:'A',available:true,capacity:3,shiftStart:540,shiftEnd:810}],routes:{a:[]}};
 const exact=exactSmallRouteOptimum(s);assert.equal(exact.feasible,true);assert.ok(exact.verifiedFullAssignments>=1);
 assert.equal(verifyPlan(s,exact.routes).valid,true);
 assert.ok(Math.abs(exact.exactRawKm-2.4)<1e-6);
});
test('oracle refuses full-size instances rather than presenting a fake optimum',()=>{
 const s={stops:Array.from({length:8},(_,id)=>({id:String(id)})),drivers:[]};
 assert.throws(()=>exactSmallRouteOptimum(s),/limited/);
});
