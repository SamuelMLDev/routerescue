/** Isolated dual-coordinator authentication/integrity integration test. */
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const port=46000+Math.floor(Math.random()*1000),dir=mkdtempSync(path.join(os.tmpdir(),'rr-auth-'));
const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ROUTERESCUE_DATA_FILE:path.join(dir,'state.json'),ROUTERESCUE_USERS_JSON:JSON.stringify({alex:'AnExampleSecret123!',pat:'AnotherExampleSecret123!'})},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
async function request(route,body,token){const headers={};if(body)headers['Content-Type']='application/json';if(token)headers.Cookie=token;
 const response=await fetch(base+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function main(){try{
 let healthy=false;for(let t=0;t<45;t++){try{if((await request('/api/health')).status===200){healthy=true;break;}}catch{}await new Promise(done=>setTimeout(done,100));}assert.ok(healthy);
 assert.equal((await request('/api/state')).status,401);
 assert.equal((await request('/api/login',{username:'alex',password:'badpassword123456'})).status,401);
 const alex=await request('/api/login',{username:'alex',password:'AnExampleSecret123!'}),pat=await request('/api/login',{username:'pat',password:'AnotherExampleSecret123!'});
 assert.equal(alex.status,200);assert.equal(pat.status,200);assert.notEqual(alex.cookie,pat.cookie);
 assert.equal((await request('/api/state',null,alex.cookie)).status,200);
 assert.equal((await request('/api/state',null,pat.cookie)).status,200);
 const noCookie=await fetch(base+'/mcp',{method:'POST',headers:{Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});assert.equal(noCookie.status,401);
 const edit=await request('/api/rescue',{driverId:'sam'},alex.cookie);assert.equal(edit.status,200,JSON.stringify(edit.data));
 const approve=await request('/api/approval',{proposalId:edit.data.proposal.id,expectedVersion:edit.data.state.version},alex.cookie);assert.equal(approve.status,200);
 const wrong=await request('/api/commit',{proposalId:edit.data.proposal.id,approvalToken:approve.data.token},pat.cookie);assert.equal(wrong.status,403);
 const correct=await request('/api/commit',{proposalId:edit.data.proposal.id,approvalToken:approve.data.token},alex.cookie);assert.equal(correct.status,200);
 assert.equal(correct.data.state.mode,'committed');
 const again=await request('/api/commit',{proposalId:edit.data.proposal.id,approvalToken:approve.data.token},alex.cookie);assert.equal(again.status,403);
 const undoAuth=await request('/api/rollback-approval',{expectedVersion:correct.data.state.version},pat.cookie);assert.equal(undoAuth.status,200);
 const wrongUndo=await request('/api/undo',{rollbackToken:undoAuth.data.token},alex.cookie);assert.equal(wrongUndo.status,403);
 const undo=await request('/api/undo',{rollbackToken:undoAuth.data.token},pat.cookie);assert.equal(undo.status,200);
 console.log('AUTH PASS: two real login sessions; protected state and MCP; cross-user token replay denied; exact human approval; rollback bound to requesting coordinator.');
 }finally{child.kill();child.unref();rmSync(dir,{recursive:true,force:true});}}
main().catch(e=>{console.error('AUTH FAIL',e);process.exitCode=1;});
