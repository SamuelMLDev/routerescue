/** Small, honest finite-state intent interpreter — not a remotely hosted LLM. */
export function interpret(text,drivers){
 if(typeof text!=='string'||text.trim().length<3||text.length>300)throw Error('Describe an incident in 3–300 characters');
 const lower=text.toLowerCase();
 // Conversational text is not an authority to write: questions, negation, unclear
 // scope and instructions embedded in a prompt-injection attempt must not mutate state.
 if(/\b(?:don't|do not|never|without|shouldn't|mustn't)\s+(?:cancel|mark|remove|disable|change|changing|reassign)\b/i.test(lower))return {type:'requires_clarification',reason:'No changes made. Please state an affirmative operational instruction or choose a read-only simulation.'};
 if(/\b(?:all|every|everyone|entire team|whole fleet)\s+(?:drivers?|volunteers?)\b/i.test(lower)&&/\b(?:cancel|off|out|unavailable|remove|dismiss)\b/i.test(lower))return {type:'requires_clarification',reason:'A bulk driver cancellation needs explicit named drivers. Nothing was changed.'};
 if(/\b(approve|authorize|authorise|commit|dispatch now|send orders)\b/.test(lower))return {type:'requires_human',reason:'Dispatch changes can only be approved with the explicit review button. The agent cannot self-authorise.'};
 if(/\b(ignore (?:all |previous |safety |the )?(?:instructions|safeguards|rules)|bypass (?:security|approval)|override (?:policy|guardrails)|system prompt)\b/i.test(lower))return {type:'requires_clarification',reason:'I cannot follow instructions to bypass operational controls. Please describe the actual dispatch change or request a read-only scenario.'};
 const mentioned=drivers.filter(d=>new RegExp(`\\b${d.name.split(' ')[0].toLowerCase()}\\b|\\b${d.id}\\b`,'i').test(text)).map(d=>d.id);
 // Counterfactual prompts never mutate live dispatch. Read-only MCP tools handle these.
 if(/\b(weakest link|fragil\w*|vulnerab\w*.*driver|driver vulnerab\w*|single.point.of.failure|most risky|risk sweep|resilience sweep|which driver.*(?:hurt|disrupt|worst)|most critical volunteer)\b/.test(lower))return {type:'resilience'};
 const simulation=/\b(what if|suppose|hypothetical|simulate|simulation|imagine|scenario|could.*backup|test the loss of|run a simulation)\b/.test(lower);
 if(simulation){
  const capacity=lower.match(/(?:backup|extra|additional|relief)\s+(?:driver\s+)?(?:with\s+)?(\d{1,2})/)||lower.match(/(\d{1,2})[- ](?:stop|parcel).*backup/);
  const backupCapacity=capacity?Math.min(16,Number(capacity[1])):0;
  return {type:'what_if',driverIds:mentioned,backupCapacity,strategy:/\b(priority|urgent)\b/.test(lower)?'priority':/\b(shortest|distance)\b/.test(lower)?'distance':'balanced'};
 }
 if(lower.trim().endsWith('?')&&!/\b(why|explain|safe|proof|verify|how|risk|constraint|uncovered|what if|suppose|simulate)\b/i.test(lower))return {type:'requires_clarification',reason:'This sounds like a question rather than a confirmed change. No operational state changed.'};
 const segments=lower.split(/[,;.]/).map(x=>x.trim()).filter(Boolean);
 const shifts=[],cancellations=[];
 for(const segment of segments){
  const named=drivers.filter(d=>new RegExp(`\\b${d.name.split(' ')[0].toLowerCase()}\\b|\\b${d.id}\\b`,'i').test(segment));
  const match=segment.match(/\b(?:until|by|leave at|finish at|finish by|stay to|ends? at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if(match&&named.length){let hour=Number(match[1]),min=Number(match[2]||0);if(min>=60)throw Error('Invalid time');
   if(match[3])hour=(hour%12)+(match[3]==='pm'?12:0);
   if(hour<8||hour>18)throw Error('Shift end must fall between 08:00 and 18:00');
   shifts.push(...named.map(d=>({driverId:d.id,shiftEnd:hour*60+min})));
  }else if(named.length&&/\b(cancel|sick|unavailable|can't|cannot|absent|out|call.?out|no.show|broke|breakdown|cancelled|canceled|won't be (?:here|driving|coming)|isn't (?:coming|available))\b/.test(segment))cancellations.push(...named.map(d=>({driverId:d.id,unavailable:true})));
 }
 if(shifts.length)return {type:'multi_change',shifts,cancellations,strategy:/\b(priority|urgent)\b/.test(lower)?'priority':/\b(balance|fair|workload)\b/.test(lower)?'balanced':null};
 const returnToShift=/\b(back|return|returned|available again|recovered|can drive now|fixed car|car is fixed)\b/.test(lower);
 const cancellation=/\b(cancel|sick|unavailable|can't|cannot|out|absent|drop|broke|breakdown|broken down|no.show|call.?out|stop driving|cancelled|canceled|won't be (?:here|driving|coming)|isn't (?:coming|available))\b/.test(lower);
 const priority=/\b(priority|urgent|vulnerable|critical|important|protect)\b/.test(lower);
 const balanced=/\b(balance|balanced|fair|fairly|even|share|split|workload)\b/.test(lower);
 const distance=/\b(short|shortest|distance|fastest|kilometre|miles|fuel|minimi[sz]e|less driving)\b/.test(lower);
 const strategy=priority?'priority':balanced?'balanced':distance?'distance':null;
 const why=/\b(why|explain|safe|proof|verify|what.*uncovered|risk|constraint)\b/.test(lower);
 if(mentioned.length&&(returnToShift||cancellation))return {type:'incident',driverIds:mentioned,unavailable:!returnToShift,strategy};
 if(strategy)return {type:'strategy',strategy};
 if(why)return {type:'explain'};
 if(/\b(rescue|replan|recalculate|solve|reroute|plan|fix)\b/.test(lower))return {type:'replan'};
 return {type:'help'};
}
export function explain(state){const p=state.proposal;
 if(!p)return 'No plan is active. Tell me who is unavailable, or choose a scenario to begin.';
 const capacity=state.drivers.filter(d=>d.available&&!state.unavailableDriverIds.includes(d.id)).reduce((n,d)=>n+d.capacity,0);
 const reason=p.uncovered.length
  ? capacity<state.stops.length?`Only ${capacity} driver stop-slots exist for ${state.stops.length} deliveries, so full coverage is impossible without additional capacity.`:`This bounded search could not cover ${p.uncovered.length} deliveries. That does not prove no feasible assignment exists.`
  : 'Every assigned route independently passed delivery-window, vehicle-load, shift-end, and uniqueness checks.';
 return `${p.label}: ${p.metrics.covered}/${p.metrics.total} deliveries covered; ${p.metrics.priorityProtected}/${p.metrics.priorityTotal} priority stops protected. Workload spread is ${p.metrics.workloadSpreadMinutes} minutes; minimum delivery slack is ${p.metrics.minimumSlackMinutes??'not applicable'} minutes. ${reason}`;
}
