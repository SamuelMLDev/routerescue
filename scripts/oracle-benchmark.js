/** Reproducible exact-vs-heuristic comparison on 6-stop micro-instances. */
import {calculateStrategies} from '../server/planner.js';
import {exactSmallRouteOptimum} from '../server/oracle.js';
import fs from 'node:fs';
import path from 'node:path';
const output=[];
for(let variant=0;variant<6;variant++){
 const depot={id:'depot',x:50,y:50};
 const drivers=[
  {id:'offline',name:'Cancelled',available:true,capacity:6,shiftStart:540,shiftEnd:900},
  {id:'a',name:'Amina',available:true,capacity:4,shiftStart:540,shiftEnd:900},
  {id:'b',name:'Ben',available:true,capacity:4,shiftStart:540,shiftEnd:900}
 ];
 const stops=Array.from({length:6},(_,i)=>({id:`s${i+1}`,name:`Test stop ${i+1}`,x:15+((i*23+variant*7)%70),y:20+((i*13+variant*11)%60),priority:i%3===0?'Priority':'Standard',load:1,service:6,windowStart:540,windowEnd:840}));
 const s={depot,drivers,stops,routes:{offline:stops.map(x=>x.id),a:[],b:[]},unavailableDriverIds:['offline'],mode:'normal'};
 const start=performance.now(),oracle=exactSmallRouteOptimum(s,['offline']),exactMs=Math.round(performance.now()-start);
 const run=calculateStrategies(s).strategies.distance;
 const ratio=run.metrics.covered===6?Math.round(run.metrics.totalKm/oracle.minimumKm*1000)/1000:null;
 if(!oracle.feasible||!run.assertions.verified)throw Error('Micro-instance benchmark generated invalid plan');
 output.push({variant,minimumKm:oracle.minimumKm,heuristicKm:run.metrics.totalKm,coverage:run.metrics.covered,ratio,oracleNodes:oracle.searchedNodes,oracleCompleteAssignments:oracle.verifiedFullAssignments,exactMs});
}
const avg=output.reduce((n,p)=>n+p.ratio,0)/output.length;
const report={description:'Six fictional micro-instances with a cancelled driver; all six stops reassigned to two active drivers; exact exhaustive distance optimum versus bounded production heuristic.',limitations:'Exact search only works at tiny size. Ratios do not extrapolate to the 40-stop scenario. Geometry and windows are synthetic.',instances:output,meanDistanceRatio:Number(avg.toFixed(3)),worstDistanceRatio:Math.max(...output.map(p=>p.ratio))};
const file=path.resolve('benchmarks/oracle-results.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
