/** Pure, deterministic insertion + 2-opt vehicle routing with hard delivery windows. */
export const START = 9 * 60;
export const END = 13 * 60;
const SPEED_KM_PER_MIN = 0.48;
const KM_PER_MAP_UNIT = 0.075;
export function distance(a,b) { return (Math.abs(a.x-b.x)+Math.abs(a.y-b.y))*KM_PER_MAP_UNIT; }
export function travelMinutes(a,b) { return Math.ceil(distance(a,b)/SPEED_KM_PER_MIN); }
export function simulate(state, ids) {
  const index = Object.fromEntries(state.stops.map(s=>[s.id,s]));
  let at=START, previous=state.depot, km=0;
  const schedule=[];
  for (const id of ids) {
    const stop=index[id];
    if (!stop) return {valid:false,reason:`Missing stop ${id}`};
    km+=distance(previous,stop);
    const arrival=at+travelMinutes(previous,stop);
    const served=Math.max(arrival,stop.windowStart);
    if (served>stop.windowEnd) return {valid:false,reason:`${id} missed delivery window`};
    at=served+stop.service;
    schedule.push({stopId:id,arrival:served,departure:at});
    previous=stop;
  }
  km+=distance(previous,state.depot);
  const finished=at+travelMinutes(previous,state.depot);
  if(finished>END) return {valid:false,reason:'Driver shift ends before route returns'};
  return {valid:true,km:Math.round(km*10)/10,minutes:finished-START,finish:finished,schedule};
}
export function evaluate(state,routes) {
  const active=state.drivers.filter(d=>d.available && d.id!==state.unavailableDriverId);
  let km=0,mins=0; const breakdown={};
  for (const d of active) {
    const ids=routes[d.id]||[];
    if(ids.length>d.capacity) return {valid:false,reason:`${d.name} over capacity`};
    const result=simulate(state,ids);
    if(!result.valid) return {valid:false,reason:`${d.name}: ${result.reason}`};
    breakdown[d.id]=result; km+=result.km; mins+=result.minutes;
  }
  return {valid:true,km:Math.round(km*10)/10,minutes:mins,breakdown};
}
export function optimize(state,routes) {
  // Keep every hard constraint: only accept reversals that are feasible and shorter.
  for (const d of state.drivers.filter(d=>d.available && d.id!==state.unavailableDriverId)) {
    let route=routes[d.id]; if(route.length<3) continue;
    let improved=true,iterations=0;
    while(improved && iterations++<8) {
      improved=false;
      let base=simulate(state,route);
      for(let i=0;i<route.length-1;i++) for(let j=i+1;j<route.length;j++) {
        const test=[...route.slice(0,i),...route.slice(i,j+1).reverse(),...route.slice(j+1)];
        const result=simulate(state,test);
        if(result.valid && result.km<base.km-0.09) { route=test; base=result; improved=true; }
      }
    }
    routes[d.id]=route;
  }
  return routes;
}
export function rescue(state,driverId) {
  if(!state.drivers.some(d=>d.id===driverId)) throw Error('Unknown driver');
  const base=structuredClone(state);
  base.unavailableDriverId=driverId;
  const old=state.routes[driverId];
  const routes=structuredClone(state.routes);
  routes[driverId]=[];
  const remaining=[...old].sort((a,b)=> {
    const aEnd=state.stops.find(s=>s.id===a).windowEnd;
    const bEnd=state.stops.find(s=>s.id===b).windowEnd;
    return aEnd-bEnd || a.localeCompare(b);
  });
  const drivers=state.drivers.filter(d=>d.available && d.id!==driverId);
  const uncovered=[];
  for(const stopId of remaining) {
    let best=null;
    for (const driver of drivers) {
      if(routes[driver.id].length>=driver.capacity) continue;
      const baseline=simulate(base,routes[driver.id]);
      for(let pos=0;pos<=routes[driver.id].length;pos++) {
        const candidate=[...routes[driver.id]];candidate.splice(pos,0,stopId);
        const trial=simulate(base,candidate);
        if(!trial.valid) continue;
        const extra=trial.km-baseline.km;
        if(best===null || extra<best.extra-0.001 || (Math.abs(extra-best.extra)<0.001 && driver.id<best.driverId)) best={driverId:driver.id,position:pos,extra};
      }
    }
    if(best) routes[best.driverId].splice(best.position,0,stopId);
    else uncovered.push(stopId);
  }
  optimize(base,routes);
  const outcome=evaluate(base,routes);
  const reassigned=old.filter(s=>!uncovered.includes(s)).map(stopId=>({stopId,to:drivers.find(d=>routes[d.id].includes(stopId))?.id}));
  const original=evaluate(state,state.routes);
  const current=evaluate(base,Object.fromEntries([...drivers.map(d=>[d.id,state.routes[d.id]]),[driverId,[]]]));
  return {id:`rescue-${state.version}-${driverId}`,driverId,routes,uncovered,reassigned,
    valid:outcome.valid, reason:outcome.reason||null,
    metrics:{affected:old.length,covered:reassigned.length,uncovered:uncovered.length,drivers:drivers.length,
      totalKm:outcome.km||0,priorKm:original.km||0,addedKm:Math.round(((outcome.km||0)-(current.km||0))*10)/10,
      violations:outcome.valid?0:1,baselineMinutes:original.minutes||0,proposedMinutes:outcome.minutes||0},
    generatedAt:new Date().toISOString()};
}
export function assertIntegrity(state, routes, unavailableId, uncovered=[]) {
  const seen=[];
  for(const d of state.drivers) {
    const r=routes[d.id]||[];
    if(d.id===unavailableId && r.length) throw Error('Unavailable driver has assignments');
    if(d.id!==unavailableId && r.length>d.capacity) throw Error('Capacity exceeded');
    seen.push(...r);
  }
  seen.push(...uncovered);
  if(new Set(seen).size!==seen.length || seen.length!==state.stops.length || !state.stops.every(s=>seen.includes(s.id))) throw Error('Every delivery must appear exactly once (assigned or explicitly uncovered)');
  const base={...state,unavailableDriverId:unavailableId};
  if(!evaluate(base,routes).valid) throw Error('Route plan violates constraints');
}
