/** Offline audit. Works on a downloaded recovery certificate without a running server. */
import fs from 'node:fs';
import {verifyCertificate} from '../server/certificate.js';
const filepath=process.argv[2];
if(!filepath){console.error('Usage: node scripts/verify-certificate.js path/to/routerescue-recovery-certificate.json');process.exit(2);}
try{
 const doc=JSON.parse(fs.readFileSync(filepath,'utf8'));
 const result=verifyCertificate(doc);
 if(!result.valid){console.error(`FAIL — ${result.reason}`);process.exitCode=1;}
 else{console.log(`PASS — ${result.reason}`);console.log(JSON.stringify(result.facts,null,2));}
}catch(e){console.error(`FAIL — ${e.message}`);process.exitCode=1;}
