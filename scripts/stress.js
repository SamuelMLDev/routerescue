/** Seeded adversarial property tests and truthful evidence report. No network or user data. */
import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {runTwin,normalizeWhatIf} from '../server/twin.js';
import {verifyPlan} from '../server/planner.js';
import {createHash} from 'node:crypto';
const count=Number(process.argv[2]??80);if(!Number.isInteger(count)||count<1||count>1000)throw Error('Usage: node scripts/stress.js [1..1000]');
const original=JSON.parse(fs.readFileSync(new URL('../seed/demo.json',import.meta.url)));
const digest=createHash('sha256').update(JSON.stringify(original)).digest('hex');
let seed=0x6a09e667;const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/0x100000000;};
let complete=0,partial=0,failures=[],msTotal=0,worstMs=0;
for(let i=0;i<count;i++){
 const drivers=original.drivers.map(d=>d.id).filter(()=>rng()<.63);if(!drivers.length)drivers.push(original.drivers[i%original.drivers.length].id);
 const options={blocked:drivers,backupCapacity:[0,0,4,6,8][Math.floor(rng()*5)],extendWindows:[0,15,30,60][Math.floor(rng()*4)],strategy:['balanced','distance','priority'][Math.floor(rng()*3)]};
 if(rng()<.35){const d=original.drivers[Math.floor(rng()*original.drivers.length)];options.shiftChanges={[d.id]:[600,660,720,780][Math.floor(rng()*4)]};}
 try{const start=performance.now(),answer=runTwin(original,options),ms=performance.now()-start;msTotal+=ms;worstMs=Math.max(ms,worstMs);
  const sc=normalizeWhatIf(original,options).state;
  const check=verifyPlan(sc,answer.plan.routes,options.blocked,answer.plan.uncovered);
  if(!check.valid||!answer.verification.valid)throw Error('Verification failed');
  if(answer.plan.metrics.uncovered<answer.feasibility.provenCapacityShortfall)throw Error('Capacity lower bound violated');
  if(answer.plan.uncovered.length)partial++;else complete++;
 }catch(error){failures.push({case:i,options,error:String(error.message||error)});}
}
if(createHash('sha256').update(JSON.stringify(original)).digest('hex')!==digest)throw Error('Live fixture changed during stress run');
// 1000 malformed configurations do not invoke the expensive solver.
let inputRejections=0;for(let i=0;i<1000;i++){try{normalizeWhatIf(original,{blocked:['unknown-'+i],backupCapacity:i%11});}catch{inputRejections++;}}
const result={seed:'0x6a09e667',cases:count,complete,partial,failures,inputRejections,originalFixtureUnchanged:true,meanMs:Number((msTotal/count).toFixed(2)),worstMs:Number(worstMs.toFixed(2)),claims:'Synthetic property/fault testing only. Timings depend on hardware. Not real-world performance or proof of global optimality.'};
fs.mkdirSync('benchmarks',{recursive:true});fs.writeFileSync('benchmarks/stress-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
