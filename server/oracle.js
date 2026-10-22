/** Tiny-instance exact oracle for independent benchmark comparisons.
 * Exhaustive search is exponential. Do NOT use for full-size dispatch.
 * Unlike the production heuristic, checks all feasible stop assignments and orders.
 */
import {routeSimulation} from './planner.js';
export function exactSmallRouteOptimum(state,blocked=[],{maxStops=7,maxActiveDrivers=3}={}){
 if(state.stops.length>maxStops)throw Error(`Exact oracle limited to ${maxStops} stops`);
 const unavailable=new Set(blocked),drivers=state.drivers.filter(d=>d.available&&!unavailable.has(d.id));
 if(drivers.length>maxActiveDrivers)throw Error(`Exact oracle limited to ${maxActiveDrivers} active drivers`);
 const stopIds=state.stops.map(s=>s.id),routes=Object.fromEntries(state.drivers.map(d=>[d.id,[]]));
 let best=Infinity,solution=null,leafCount=0,explored=0;
 // A canonical driver-by-driver enumeration avoids duplicate interleavings.
 function assignDriver(index,remaining,accumulatedKm){
  if(index===drivers.length){
   if(remaining.length===0){leafCount++;if(accumulatedKm<best-1e-9){best=accumulatedKm;solution=structuredClone(routes);}}
   return;
  }
  const d=drivers[index],id=d.id;
  function grow(available){
   explored++;
   const sim=routeSimulation(state,routes[id],d);
   if(!sim.valid)return;
   const newKm=accumulatedKm+sim.rawKm;
   if(newKm>best+1e-9)return;
   // End this driver's route; assign remaining deliveries to the next one.
   assignDriver(index+1,available,newKm);
   if(routes[id].length>=d.capacity)return;
   for(let i=0;i<available.length;i++){
    routes[id].push(available[i]);
    grow([...available.slice(0,i),...available.slice(i+1)]);
    routes[id].pop();
   }
  }
  grow(remaining);
 }
 assignDriver(0,stopIds,0);
 return {feasible:solution!==null,minimumKm:Number.isFinite(best)?Math.round(best*10)/10:null,exactRawKm:Number.isFinite(best)?best:null,routes:solution,verifiedFullAssignments:leafCount,searchedNodes:explored};
}
