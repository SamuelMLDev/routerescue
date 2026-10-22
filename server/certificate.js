/** Portable, self-contained evidence for a synthetic dispatch recovery.
 * The validator deliberately does not import or call the route planner.
 * SHA-256 detects accidental alteration, not author identity or trusted time.
 */
import crypto from 'node:crypto';
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const eq=(a,b,tolerance=1e-6)=>Math.abs(a-b)<tolerance;
const fail = message => ({valid:false,reason:message});
const oneDecimal=n=>Math.round(n*10)/10;

export function createCertificate(state) {
  if(!state?.proposal||!['proposed','committed'].includes(state.mode))throw Error('Compute a recovery proposal before exporting its evidence');
  const {proposal:p}=state;
  const payload={
    format:'routerescue.recovery-certificate.v1',
    disclaimer:'Synthetic geography and fictional identities. Not a proof of optimality, authorship, trusted time, or real-world travel accuracy.',
    version:state.version,
    status:state.mode,
    proposalId:p.id,
    strategy:state.selectedStrategy,
    depot:structuredClone(state.depot),
    travelMatrix:state.travelMatrix?structuredClone(state.travelMatrix):null,
    drivers:structuredClone(state.drivers),
    stops:structuredClone(state.stops),
    unavailableDriverIds:[...state.unavailableDriverIds],
    baselineRoutes:structuredClone(state.mode==='committed'&&state.history?state.history.routes:state.routes),
    proposedRoutes:structuredClone(p.routes),
    uncovered:[...p.uncovered],
    claimed:{...p.metrics},
    auditHead:state.audit?.at(-1)?.hash??null,
  };
  return {payload,sha256:hash(payload)};
}

/** Separate constraint checker; recomputes every stop's arrival from raw data. */
export function verifyCertificate(document) {
  try {
    if(!document||typeof document!=='object'||!document.payload||typeof document.sha256!=='string')return fail('Not a recovery certificate');
    if(document.payload.format!=='routerescue.recovery-certificate.v1')return fail('Unsupported certificate format');
    if(hash(document.payload)!==document.sha256)return fail('Payload hash does not match: certificate was modified');
    const p=document.payload;
    if(!Array.isArray(p.drivers)||!Array.isArray(p.stops)||!Array.isArray(p.uncovered)||!Array.isArray(p.unavailableDriverIds)||!p.proposedRoutes||!p.claimed||!p.depot)return fail('Certificate is missing required fields');
    if(p.drivers.length>200||p.stops.length>3000||p.uncovered.length>3000)return fail('Certificate exceeds verification limits');
    const knownDrivers=new Set(),stopById=new Map(),covered=new Set(),blocked=new Set(p.unavailableDriverIds);
    for(const d of p.drivers){if(typeof d.id!=='string'||knownDrivers.has(d.id)||!Number.isFinite(d.capacity)||d.capacity<0)return fail('Invalid or duplicate driver');knownDrivers.add(d.id);}
    for(const s of p.stops){if(typeof s.id!=='string'||stopById.has(s.id)||![s.x,s.y,s.windowStart,s.windowEnd,s.service].every(Number.isFinite)||s.windowEnd<s.windowStart||s.service<0)return fail('Invalid or duplicate delivery');stopById.set(s.id,s);}
    if(![p.depot.x,p.depot.y].every(Number.isFinite))return fail('Invalid depot');
    for(const id of blocked)if(!knownDrivers.has(id))return fail(`Unknown unavailable driver ${id}`);
    if(Object.keys(p.proposedRoutes).some(id=>!knownDrivers.has(id)))return fail('Evidence contains an unknown or phantom driver route');
    const kmBetween=(a,b)=>0.075*(Math.abs(a.x-b.x)+Math.abs(a.y-b.y));
    const drive=(a,b)=>Math.ceil(kmBetween(a,b)/0.48);
    const road=(a,b)=>{if(!p.travelMatrix)return {km:kmBetween(a,b),minutes:drive(a,b)};const from=a.id??'depot',to=b.id??'depot';if(from===to)return {km:0,minutes:0};const leg=p.travelMatrix.legs?.[`${from}>${to}`];if(!leg||!Number.isFinite(leg.km)||leg.km<0||!Number.isInteger(leg.minutes)||leg.minutes<0)throw Error(`Missing or invalid road leg ${from}>${to}`);return leg;};
    let totalKm=0,minSlack=Infinity,assigned=0,protectedCount=0;
    for(const d of p.drivers){
      const route=p.proposedRoutes[d.id];
      if(!Array.isArray(route))return fail(`Missing assigned route for ${d.id}`);
      if(route.length>d.capacity)return fail(`Stop-count capacity exceeded on ${d.id}`);
      if((blocked.has(d.id)||!d.available)&&route.length)return fail(`Unavailable volunteer ${d.id} has deliveries`);
      let now=d.shiftStart??540,last=p.depot,load=0,km=0;
      for(const id of route){
        const stop=stopById.get(id);
        if(!stop||covered.has(id))return fail(`Invalid or duplicated assignment ${id}`);
        covered.add(id);assigned++;if(stop.priority==='Priority')protectedCount++;
        if(stop.lockedDriver&&stop.lockedDriver!==d.id)return fail(`Delivery ${id} is locked to ${stop.lockedDriver}`);
        if(stop.requires&&!(d.skills||[]).includes(stop.requires))return fail(`Missing driver skill for ${id}`);
        load+=(stop.load??1);
        if(load>(d.maxLoad??d.capacity))return fail(`Parcel-load capacity exceeded on ${d.id}`);
        const leg=road(last,stop);km+=leg.km;
        now=Math.max(now+leg.minutes,stop.windowStart);
        if(now>stop.windowEnd)return fail(`Delivery window exceeded for ${id}`);
        minSlack=Math.min(minSlack,stop.windowEnd-now);
        now+=stop.service;
        last=stop;
      }
      const home=road(last,p.depot);km+=home.km;
      now+=home.minutes;
      if(now>(d.shiftEnd??780))return fail(`Driver ${d.id} cannot return before shift end`);
      if(route.length)totalKm+=km;
    }
    for(const id of p.uncovered){if(!stopById.has(id)||covered.has(id))return fail(`Invalid uncovered delivery ${id}`);covered.add(id);}
    if(covered.size!==p.stops.length)return fail('Some deliveries are not accounted for');
    const priorityTotal=p.stops.filter(s=>s.priority==='Priority').length;
    const m=p.claimed;
    if(m.total!==p.stops.length||m.covered!==assigned||m.uncovered!==p.uncovered.length||m.priorityProtected!==protectedCount||m.priorityTotal!==priorityTotal)return fail('Claimed coverage differs from recomputed facts');
    if(!eq(m.totalKm,oneDecimal(totalKm),0.00001))return fail('Claimed kilometres differ from recomputed geometry');
    if(m.violations!==0)return fail('Claimed validation status is not zero violations');
    if(m.minimumSlackMinutes!==null&&m.minimumSlackMinutes!==undefined&&m.minimumSlackMinutes!==minSlack)return fail('Claimed smallest deadline margin is inaccurate');
    return {valid:true,reason:'Every delivery is accounted for; all route, load, skill, shift and time-window constraints were independently checked.',facts:{assigned,uncovered:p.uncovered.length,priorityProtected:protectedCount,priorityTotal,kilometres:oneDecimal(totalKm),minimumSlackMinutes:Number.isFinite(minSlack)?minSlack:null,drivers:p.drivers.length,sha256:document.sha256}};
  }catch(error){return fail(`Malformed recovery certificate: ${error.message}`);}
}
