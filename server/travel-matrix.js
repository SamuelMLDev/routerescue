/** Directed travel-leg model. The default uses synthetic geometry.
 * A trusted, externally computed time/distance matrix can instead be embedded
 * into the scenario. Missing directed legs always fail closed.
 */
import {distance,travelMinutes} from './solver.js';
const pointId=(node,depot)=>String(node.id??(node===depot?'depot':''));
export function travelLeg(state,from,to){
 if(!state.travelMatrix)return {km:distance(from,to),minutes:travelMinutes(from,to),model:'synthetic-manhattan'};
 const src=pointId(from,state.depot),dst=pointId(to,state.depot);
 if(!src||!dst)throw Error('Travel-matrix endpoint is missing a stable ID');
 if(src===dst)return {km:0,minutes:0,model:'directed-matrix'};
 const cell=state.travelMatrix?.legs?.[`${src}>${dst}`];
 if(!cell||!Number.isFinite(cell.km)||cell.km<0||!Number.isInteger(cell.minutes)||cell.minutes<0)throw Error(`Missing or invalid directed travel-matrix leg: ${src}>${dst}`);
 return {km:cell.km,minutes:cell.minutes,model:'directed-matrix'};
}
export function validateTravelMatrix(state){
 if(!state.travelMatrix)return {valid:true,model:'synthetic-manhattan',legs:0};
 const matrix=state.travelMatrix;
 if(matrix.model!=='directed-road-matrix-v1'||!matrix.legs||typeof matrix.legs!=='object'||Array.isArray(matrix.legs))throw Error('Invalid travel-matrix model');
 const ids=['depot',...state.stops.map(s=>s.id)];if(new Set(ids).size!==ids.length)throw Error('Travel matrix requires distinct stop IDs');
 if(ids.length>300)throw Error('Travel-matrix import exceeds the supported 299-stop limit');
 for(const from of ids)for(const to of ids){if(from===to)continue;
  const v=matrix.legs[`${from}>${to}`];if(!v||!Number.isFinite(v.km)||v.km<0||!Number.isInteger(v.minutes)||v.minutes<0)throw Error(`Invalid directed matrix edge ${from}>${to}`);
 }
 return {valid:true,model:matrix.model,legs:ids.length*(ids.length-1),source:matrix.source??'unverified user supplied travel data'};
}
