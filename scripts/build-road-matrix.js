/** Optional OSRM-compatible road matrix converter. Requires a running routing
 * service and geocoded consented data supplied by the operator. Not part of the
 * offline fictional fixture and never invoked in the default demo path.
 *
 * node scripts/build-road-matrix.js your-stops.json your-matrix.json
 * OSRM_BASE_URL=https://your-osrm-host.example (must use HTTPS or localhost)
 */
import fs from 'node:fs';
import {validateTravelMatrix} from '../server/travel-matrix.js';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath)throw Error('Usage: node scripts/build-road-matrix.js <geocoded-manifest.json> <output-matrix.json>');
const manifest=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const stops=[{...manifest.depot,id:'depot'},...manifest.stops];
if(stops.length>100)throw Error('OSRM table export limited to 99 stops for request size and privacy.');
if(stops.some(s=>!Number.isFinite(s.lat)||!Number.isFinite(s.lon)||Math.abs(s.lat)>90||Math.abs(s.lon)>180))throw Error('Every stop and depot needs finite lat/lon. No geocoding or recipient lookup is performed.');
const base=process.env.OSRM_BASE_URL;
if(!base)throw Error('OSRM_BASE_URL must point to your own routing server or a provider you are authorised to use.');
const uri=new URL(base);if(uri.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(uri.hostname))throw Error('OSRM endpoint must use HTTPS or localhost');
const coordinates=stops.map(s=>`${s.lon},${s.lat}`).join(';');
const target=new URL(`${uri.toString().replace(/\/$/,'')}/table/v1/driving/${coordinates}?annotations=duration,distance`);
const result=await fetch(target,{signal:AbortSignal.timeout(25000)});
if(!result.ok)throw Error(`OSRM matrix request failed with HTTP ${result.status}`);
const data=await result.json();if(data.code!=='Ok'||data.durations?.length!==stops.length||data.distances?.length!==stops.length)throw Error('OSRM returned an incomplete road matrix');
const legs={};
for(let i=0;i<stops.length;i++)for(let j=0;j<stops.length;j++){if(i===j)continue;
 const sec=data.durations[i]?.[j],metres=data.distances[i]?.[j];if(!Number.isFinite(sec)||!Number.isFinite(metres))throw Error('Routing network cannot connect all stops; no fallback distances invented');
 legs[`${stops[i].id}>${stops[j].id}`]={minutes:Math.ceil(sec/60),km:Math.round(metres/100)/10};
}
const travelMatrix={model:'directed-road-matrix-v1',source:'User-supplied OSRM endpoint with externally obtained road network. Matrix is not independently authenticated.',legs};
validateTravelMatrix({stops:manifest.stops,travelMatrix});
fs.writeFileSync(outputPath,JSON.stringify(travelMatrix,null,2)+'\n');
console.log(`Saved ${Object.keys(legs).length} directed road legs to ${outputPath}. Include travelMatrix in the manifest before route optimisation.`);
