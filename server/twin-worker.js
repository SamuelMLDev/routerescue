import {parentPort,workerData} from 'node:worker_threads';
import {runTwin,analyzeResilience,twinCertificate} from './twin.js';
import {interventionSearch} from './interventions.js';
try{
 const {action,state,options}=workerData;
 const data=action==='risk'?analyzeResilience(state):action==='intervene'?interventionSearch(state,options):action==='evidence'?twinCertificate(state,options):runTwin(state,options);
 parentPort.postMessage({ok:true,data});
}catch(error){parentPort.postMessage({ok:false,error:String(error.message||error)});}
