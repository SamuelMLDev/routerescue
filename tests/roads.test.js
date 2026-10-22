import test from 'node:test';import assert from 'node:assert/strict';
import {travelLeg,validateTravelMatrix} from '../server/travel-matrix.js';
import {routeSimulation} from '../server/planner.js';
import {createCertificate,verifyCertificate} from '../server/certificate.js';
test('directed road matrix changes actual routing time and distance, independent verifier agrees',()=>{
 const depot={id:'depot',x:0,y:0},stop={id:'s1',name:'A',x:2,y:2,windowStart:540,windowEnd:800,service:5,priority:'Priority'};
 const d={id:'d',name:'Driver',available:true,capacity:1,shiftStart:540,shiftEnd:640};
 const travelMatrix={model:'directed-road-matrix-v1',source:'unit test data',legs:{'depot>s1':{km:3,minutes:14},'s1>depot':{km:7,minutes:28}}};
 const s={depot,stops:[stop],drivers:[d],routes:{d:['s1']},mode:'normal',unavailableDriverIds:[],travelMatrix,version:1};
 assert.equal(validateTravelMatrix(s).valid,true);
 assert.equal(travelLeg(s,depot,stop).minutes,14);assert.equal(travelLeg(s,stop,depot).minutes,28);
 const simulated=routeSimulation(s,['s1'],d);assert.equal(simulated.km,10);assert.equal(simulated.finish,587);
 const p={id:'road',routes:s.routes,uncovered:[],metrics:{total:1,covered:1,uncovered:0,priorityProtected:1,priorityTotal:1,totalKm:10,violations:0,minimumSlackMinutes:246}};
 const certificate=createCertificate({...s,mode:'proposed',proposal:p,selectedStrategy:'distance'});
 assert.equal(verifyCertificate(certificate).valid,true);
});
test('missing road legs fail closed: no silently invented Manhattan distances',()=>{
 const state={depot:{id:'depot'},stops:[{id:'s'}],travelMatrix:{model:'directed-road-matrix-v1',legs:{'depot>s':{km:1,minutes:3}}}};
 assert.throws(()=>validateTravelMatrix(state),/Missing|Invalid/);
 assert.throws(()=>travelLeg(state,state.stops[0],state.depot),/Missing or invalid/);
});
