/** Bound CPU-intensive counterfactual work without blocking MCP heartbeats or UI health. */
import {Worker} from 'node:worker_threads';
let activeWorkers=0;
export function simulateInWorker(action,state,options={}){
 if(activeWorkers>=3)return Promise.reject(Error('All simulation slots are busy. Retry once a scenario finishes.'));
 activeWorkers++;
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./twin-worker.js',import.meta.url),{workerData:{action,state,options}});
  let settled=false;const finish=(err,value)=>{if(settled)return;settled=true;activeWorkers--;clearTimeout(timer);if(err){void worker.terminate();reject(err);}else resolve(value);};
  const timer=setTimeout(()=>finish(Error('Scenario calculation exceeded 45-second safety limit')),45000);
  worker.on('message',msg=>msg.ok?finish(null,msg.data):finish(Error(msg.error)));
  worker.on('error',err=>finish(err));worker.on('exit',code=>{if(!settled)finish(Error(`Simulation worker exited (${code})`));});
 });
}
