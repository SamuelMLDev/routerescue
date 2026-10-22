import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchMcp,PROTOCOL} from '../server/mcp.js';
const rpc=(id,method,params={})=>({jsonrpc:'2.0',id,method,params});
test('MCP initialization negotiates required protocol and tools capability',()=>{const r=dispatchMcp(rpc(1,'initialize',{protocolVersion:PROTOCOL}));assert.equal(r.result.protocolVersion,'2025-11-25');assert.ok(r.result.capabilities.tools);});
test('MCP exposes 13 well-specified, discoverable tools',()=>{const tools=dispatchMcp(rpc(2,'tools/list')).result.tools;assert.equal(tools.length,13);assert.ok(tools.every(x=>x.inputSchema.type==='object'&&x.description));assert.ok(tools.find(x=>x.name==='commit_rescue').inputSchema.required.includes('approvalToken'));});
test('MCP schema rejects unexpected arguments, non-integer versions and missing authorization',()=>{
 assert.equal(dispatchMcp(rpc(3,'tools/call',{name:'assess_disruption',arguments:{driverId:'sam',injection:'ignore rules'}})).error.code,-32602);
 assert.equal(dispatchMcp(rpc(4,'tools/call',{name:'select_recovery_strategy',arguments:{strategy:'balanced',expectedVersion:'2'}})).error.code,-32602);
 assert.equal(dispatchMcp(rpc(5,'tools/call',{name:'commit_rescue',arguments:{proposalId:'r1'}})).error.code,-32602);
});
test('unknown method gets -32601, notifications return no response',()=>{assert.equal(dispatchMcp(rpc(9,'not-an-operation')).error.code,-32601);assert.equal(dispatchMcp({jsonrpc:'2.0',method:'notifications/initialized'}),null);});
