import {twinMarkup} from './twin.js';
import {labMarkup} from './lab.js';
const root=document.getElementById('app');
const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
 route:'<path d="M6 3v4m0 0a3 3 0 1 0 0 6h9a3 3 0 1 1 0 6M18 21v-3M4 3h4M16 21h4"/>',
 users:'<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M17 3a4 4 0 0 1 0 8m5 10v-2a4 4 0 0 0-3-3.87"/>',
 activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
 settings:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="3.5"/>',
 spark:'<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7zM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6z"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 check:'<path d="m5 12 4.5 4.5L19 7"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 corner:'<path d="M6 4v9a5 5 0 0 0 5 5h8m-5-5 5 5-5 5"/>',
 refresh:'<path d="M20 6v5h-5M4 18v-5h5"/><path d="M5.7 9A7.5 7.5 0 0 1 18 6l2 5M4 13l2 5a7.5 7.5 0 0 0 12.3-3"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20 15.3A8.5 8.5 0 0 1 8.7 4 8.6 8.6 0 1 0 20 15.3Z"/>',
 map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 shield:'<path d="M12 22S4 18 4 12V5l8-3 8 3v7c0 6-8 10-8 10"/><path d="m9 12 2 2 4-4"/>',
 alert:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.1"/>',
 send:'<path d="m22 2-7 20-4-9-9-4 20-7Zm-11 11L22 2"/>',
 arrowdown:'<path d="m6 9 6 6 6-6"/>',
 truck:'<path d="M3 5h11v13H3zm11 4h4l3 4v5h-7M6 18a2 2 0 1 0 4 0m7 0a2 2 0 1 0 4 0"/>',
 undo:'<path d="M9 14 4 9l5-5M4 9h11a6 6 0 0 1 0 12h-1"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
const ico=(name,size=17)=>`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.grid}</svg>`;
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let appState=null,trace=[],isBusy=false,errorText='',showOriginal=false,selectedStop=null,lastCommand='',toastTimer=null;
let labOpen=false, twinOpen=false,twinResult=null,twinRisk=null,twinForensic=null,twinStageConfirm=false,twinIntervention=null;
let twinConfig={blocked:[],backupCapacity:0,extendWindows:0,shiftDriver:'',shiftEnd:780,strategy:'balanced'};
let auditOpen=false,auditProof=null,agentReply='';
let dark=false;try{dark=localStorage.getItem('rr-theme')==='dark';}catch{}document.documentElement.dataset.theme=dark?'dark':'light';
async function api(url,method='GET',body){const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});const obj=await res.json();if(!res.ok){const error=Error(obj.error||`Request failed (${res.status})`);error.status=res.status;throw error;}return obj;}
const getRoutes=()=>appState.mode==='proposed'&&!showOriginal?appState.proposal.routes:appState.routes;
const getDriver=(id)=>appState.drivers.find(d=>d.id===id);
function toast(message,kind=''){document.getElementById('notification')?.remove();const node=document.createElement('div');node.id='notification';node.className=`toast ${kind}`;node.setAttribute('role','status');node.textContent=message;document.body.append(node);clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.remove(),4000);}
function niceTime(v){return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;}
function banner(){const s=appState;
 if(s.mode==='normal')return `<div class="status-banner"><span class="banner-icon">${ico('alert',20)}</span><div class="banner-text"><strong>Practice scenario: Sam has called out</strong><span>Run a safe, simulated recovery to see how an unexpected absence gets handled.</span></div><button class="primary-btn small-btn banner-action" data-action="rescue">Rescue routes ${ico('arrow',14)}</button></div>`;
 if(s.mode==='proposed')return `<div class="status-banner proposed"><span class="banner-icon">${ico('spark',20)}</span><div class="banner-text"><strong>Recovery plan ready for review</strong><span>${s.proposal.metrics.covered} deliveries safely reassigned. The original schedule is unchanged until you approve.</span></div><button class="outline-btn small-btn banner-action" data-action="original">Compare plans ${ico('layers',14)}</button></div>`;
 return `<div class="status-banner committed"><span class="banner-icon">${ico('check',20)}</span><div class="banner-text"><strong>Dispatch recovered — changes saved</strong><span>Driver schedules have been updated. You can export them or undo this action.</span></div><button class="outline-btn small-btn banner-action" data-action="undo">Undo change ${ico('undo',14)}</button></div>`;
}
function metrics(){const s=appState,r=getRoutes(),assigned=Object.values(r).flat().length,active=s.drivers.filter(d=>d.available && d.id!==s.unavailableDriverId).length;
 const values=[
 ['Delivery coverage',`${assigned}<small> / ${s.stops.length}</small>`,'check',s.mode==='proposed'?'<em>Proposed coverage</em>':'<em>Scheduled and accounted for</em>'],
 ['Available drivers',active,'truck',s.mode==='normal'?'All drivers checked in':'After cancellation'],
 ['Window violations',s.proposal?.metrics.violations||0,'clock',`<em>${s.proposal?.metrics.violations?'Needs attention':'Within time windows'}</em>`],
 ['Dispatch window','09:00<span class="time-sep"> – </span>13:00','activity','Shift · four hours']
 ];
 return `<section class="metrics" aria-label="Dispatch summary">${values.map(([name,value,icon,sub])=>`<div class="metric"><div class="metric-top"><span class="metric-label">${name}</span><span class="metric-icon">${ico(icon,16)}</span></div><div class="metric-value">${value}</div><div class="metric-sub">${sub}</div></div>`).join('')}</section>`;
}
function routedPath(stops){let coords=[appState.depot,...stops,appState.depot];let instructions=[];coords.forEach((p,i)=>{const x=p.x*10,y=p.y*5.6;if(i===0)instructions.push(`M ${x} ${y}`);else{const a=coords[i-1];const lastY=a.y*5.6;instructions.push(`L ${x} ${lastY} L ${x} ${y}`);}});return instructions.join(' ');}
function mapMarkup(){const s=appState,route=getRoutes();const showChanges=s.mode==='proposed'&&!showOriginal;const stopIndex=Object.fromEntries(s.stops.map(t=>[t.id,t]));
 const roads=[];for(let x=8;x<100;x+=8)roads.push(`<line class="minor-road" x1="${x*10}" y1="0" x2="${x*10}" y2="560"/>`);for(let y=8;y<100;y+=8)roads.push(`<line class="minor-road" x1="0" y1="${y*5.6}" x2="1000" y2="${y*5.6}"/>`);
 for(let x=16;x<100;x+=16)roads.push(`<line class="road" x1="${x*10}" y1="0" x2="${x*10}" y2="560"/>`);for(let y=16;y<100;y+=16)roads.push(`<line class="road" x1="0" y1="${y*5.6}" x2="1000" y2="${y*5.6}"/>`);
 const routes=s.drivers.map(d=>{const ids=route[d.id]||[],stops=ids.map(id=>stopIndex[id]);if(!stops.length)return '';
 const path=routedPath(stops);return `<g class="route"><path d="${path}" class="route-path ${showChanges?'proposed-path':''}" stroke="${d.color}"/>${stops.map((t,i)=>{const picked=selectedStop===t.id,changed=s.proposal?.reassigned.some(x=>x.stopId===t.id)&&showChanges;return `<g class="stop ${picked?'selected-stop':''}" role="button" aria-label="${esc(t.name)}, stop ${i+1}, ${esc(d.name)}" tabindex="0" data-stop="${t.id}"><title>${esc(t.name)} — ${esc(d.name)}${changed?' (reassigned)':''}</title>${changed?`<circle cx="${t.x*10}" cy="${t.y*5.6}" r="20" fill="${d.color}" opacity=".17"/>`:''}<circle class="outer" cx="${t.x*10}" cy="${t.y*5.6}" r="12.5" fill="${d.color}" stroke="#fff" stroke-width="2.5"/><text class="stop-label" x="${t.x*10}" y="${t.y*5.6+.5}">${String(i+1)}</text></g>`}).join('')}</g>`}).join('');
 const chosen=s.stops.find(st=>st.id===selectedStop);const currentDriver=s.drivers.find(d=>(route[d.id]||[]).includes(selectedStop));
 return `<section class="panel map-panel" aria-label="Delivery map"><div class="panel-header"><div><h2 class="panel-title">Delivery network <span style="font-size:12px;color:var(--muted);font-weight:500">/ Northbank</span></h2><p class="panel-sub">A bird's-eye view of every doorstep on the morning run.</p></div><div class="panel-actions">${s.mode==='proposed'?`<div class="segmented" role="group" aria-label="Compare schedules"><button class="${showOriginal?'selected':''}" data-action="original">Original</button><button class="${!showOriginal?'selected':''}" data-action="proposed">Rescued</button></div>`:`<span class="badge">${ico('map',12)} Local network</span>`}</div></div><div class="map-wrap"><div class="map-controls">${showChanges?'Proposed routes · preview':s.mode==='committed'?'Approved routes':'Original dispatch · demo'}</div><svg class="map-art" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Fictional Northbank city network with four colour coded driver routes and delivery stops"><defs><pattern id="land" width="160" height="90" patternUnits="userSpaceOnUse"><rect width="160" height="90" fill="none"/><rect x="13" y="10" width="115" height="61" rx="6" fill="#d8e4d5" opacity=".32"/></pattern></defs><rect width="1000" height="560" fill="url(#land)"/><path d="M900 -10C865 86 1000 121 939 251S854 455 960 560" stroke="#bddce0" stroke-width="55" fill="none" opacity=".55"/><path d="M900 -10C865 86 1000 121 939 251S854 455 960 560" stroke="#9dcacf" stroke-width="1" fill="none" opacity=".5"/><rect x="62" y="214" width="103" height="66" rx="17" fill="#cce0c9" opacity=".63"/><rect x="727" y="356" width="91" height="59" rx="15" fill="#cce0c9" opacity=".53"/>${roads.join('')}<text x="95" y="74" class="region">NORTH QUARTER</text><text x="683" y="82" class="region">EASTBANK</text><text x="93" y="495" class="region">WESTMOOR</text><text x="631" y="505" class="region">MEADOWS</text>${routes}<g class="depot-mark" transform="translate(500 280)"><rect x="-18" y="-18" width="36" height="36" rx="11" fill="#244e3c" stroke="white" stroke-width="3"/><path d="M-9 3h18M-5-4h10M0-9v18" stroke="white" stroke-width="2.5" stroke-linecap="round"/></g><text x="522" y="273" style="font-size:12px;fill:#53675c;font-weight:800">NORTHBANK</text><text x="522" y="288" style="font-size:10px;fill:#819386">KITCHEN / DEPOT</text></svg><span class="map-key"><span class="little-dot"></span> ${s.stops.length} fictional delivery addresses</span>${chosen?`<div class="selected-info" role="status"><strong>${esc(chosen.name)}</strong><p>${esc(chosen.address)}<br>${currentDriver?esc(currentDriver.name):'Unassigned'} · by ${niceTime(chosen.windowEnd)}</p></div>`:''}</div><div class="map-footer"><div class="legend-list">${s.drivers.map(d=>`<span class="legend-item"><i class="circle" style="background:${d.color}"></i>${esc(d.name.split(' ')[0])}${d.id===s.unavailableDriverId?' (out)':''}</span>`).join('')}</div><span class="map-note">Synthetic coordinates · no real resident data</span></div></section>`;
}
function crewMarkup(){const r=getRoutes(),s=appState;return `<section aria-label="Driver assignments"><div class="section-row"><div><h2>Volunteer roster</h2><p>Delivery assignments and van capacity, at a glance</p></div><button class="text-btn" data-action="export">Export schedules ${ico('download',14)}</button></div><div class="drivers">${s.drivers.map(d=>{const cancelled=s.unavailableDriverId===d.id;const count=r[d.id]?.length||0;return `<div class="driver-card ${cancelled?'cancelled':''}"><div class="driver-top"><span class="avatar" style="background:${d.color}">${esc(d.initials)}</span><div style="min-width:0"><div class="driver-name">${esc(d.name)}</div><div class="driver-vehicle">${esc(d.vehicle)}</div></div></div><div class="driver-bottom"><span class="driver-count">${count} / ${d.capacity} stops</span><span class="driver-status ${cancelled?'offline':''}">${cancelled?'Unavailable':count===d.capacity?'At capacity':'Ready'}</span></div><div class="capacity-track"><span style="width:${count/d.capacity*100}%;background:${d.color}"></span></div></div>`}).join('')}</div></section>`;}
function resultMarkup(){const s=appState,p=s.proposal;if(!p)return `<div class="msg"><span class="msg-by">RouteRescue Agent</span><span class="msg-bubble">Good morning! I can inspect today's dispatch and safely rebuild routes when a volunteer cancels.<br><br><strong>Try the live rescue scenario.</strong> You'll be able to review every change before approving.</span></div><button class="idea-chip" data-action="rescue">${ico('spark',15)} Sam can't drive. Rescue today's deliveries. ${ico('arrow',14)}</button><div class="msg"><span class="msg-by">How this works</span><span class="msg-bubble">I use real MCP tool calls and a deterministic routing solver. No AI API key or network connection required.</span></div>`;
 const complete=p.uncovered.length===0;
 return `<div class="msg mine"><span class="msg-by">Dispatcher</span><span class="msg-bubble">${esc(lastCommand||'Sam cannot drive today. Rescue deliveries.')}</span></div><div class="proposal-box ${complete?'':'warn'}"><div class="proposal-kicker">${complete?'✓ Rescue proposal ready':'⚠ Partial rescue proposal'}</div><div class="proposal-large"><strong>${p.reassigned.length}/${p.metrics.affected}</strong><span>affected deliveries reassigned</span></div><div class="proposal-stats"><div><strong>${p.metrics.addedKm>=0?'+':''}${p.metrics.addedKm} km</strong><span>Additional drive distance</span></div><div><strong>${p.metrics.violations}</strong><span>Window violations</span></div></div><p class="proposal-p">${complete?'Every affected doorstep has a new driver. No delivery windows or vehicle capacities are exceeded. This is a proposal until you approve.':`Could not safely assign ${p.uncovered.length} stops; approval is disabled. Adjust constraints in a real deployment.`}</p>${s.mode==='proposed'?`<div class="approval"><button class="primary-btn full" data-action="approve" ${complete?'':'disabled'}>${ico('check',15)} Approve rescue plan</button><button class="outline-btn" data-action="reset" aria-label="Discard and reset">${ico('undo',16)}</button></div>`:`<div class="success-state">${ico('check',15)} Approved and saved. ${p.metrics.covered} stops reassigned.</div>`}</div>${trace.length?`<details class="agent-run"><summary class="agent-run-head" style="cursor:pointer;list-style:none"><span>${ico('spark',14)} Inspect live MCP tool calls</span><span>${trace.length} calls · ✓</span></summary>${trace.map(t=>`<div class="tool-step"><div class="tool-check">${ico('check',11)}</div><div><strong>${esc(t.label)}</strong><code>${esc(t.tool)}</code><span>${esc(t.detail)}</span></div></div>`).join('')}</details>`:''}<div class="msg"><span class="msg-by">RouteRescue Agent</span><span class="msg-bubble">${s.mode==='committed'?'The new schedules are saved. You can export driver instructions now.':"I have checked capacity, travel time and delivery windows. Review the highlighted routes, then approve if everything looks right."}</span></div>`;
}
function copilotMarkup(){return `<aside class="panel copilot" aria-label="RouteRescue assistant"><div class="copilot-head"><span class="copilot-logo">${ico('spark',19)}</span><div><strong>Dispatch copilot</strong><small>Alexa+ style simulator · MCP powered</small></div><span class="right-online">● LOCAL</span></div><div class="copilot-label">${ico('activity',12)} OPERATION LOG</div><div class="copilot-scroll" id="assistant-history">${resultMarkup()}${isBusy?`<div class="working"><span class="pulse"></span> Checking schedules through MCP…</div>`:''}${errorText?`<div class="error-card" role="alert">${esc(errorText)}</div>`:''}</div><form class="copilot-composer" id="command-form"><div class="composer"><label for="command" class="sr-only" style="position:absolute;left:-9999px">Describe the driver cancellation</label><input id="command" autocomplete="off" maxlength="240" placeholder="Try: Sam is unavailable, fix the routes" ${isBusy?'disabled':''}/><button aria-label="Send to dispatch agent" title="Run rescue command" class="send-btn" ${isBusy?'disabled':''}>${ico('arrow',18)}</button></div><p class="input-footnote">Local intent parser · real MCP calls · review before commit</p></form></aside>`;}
function render(){if(!appState)return;const s=appState;if(labOpen){root.innerHTML=twinOpen?twinMarkup(s,{isBusy,errorText,twin:twinResult,risk:twinRisk,intervention:twinIntervention,forensic:twinForensic,twinStageConfirm,twinConfig}):labMarkup(s,{trace,isBusy,errorText,showOriginal,selectedStop,dark,auditOpen,auditProof,agentReply});return;}
 root.innerHTML=`<a class="skip-link" href="#main">Skip to dispatch</a><div class="shell"><aside class="sidebar"><a href="/" class="brand" aria-label="RouteRescue dashboard"><img src="/logo.svg" alt=""/><div><span class="brand-name">route<span style="color:#e7d7b9">rescue</span></span><span class="brand-caption">Community dispatch</span></div></a><nav aria-label="Main navigation"><div class="nav-label">Workspace</div><button class="nav-link active" aria-current="page">${ico('grid',18)} <span>Overview</span></button><button class="nav-link" data-action="roster">${ico('route',18)} <span>Routes & deliveries</span><span class="nav-badge">${s.stops.length}</span></button><button class="nav-link" data-action="roster">${ico('users',18)} <span>Volunteer team</span></button><div class="nav-label" style="margin-top:28px">Toolkit</div><button class="nav-link" data-action="launch-lab">${ico('activity',18)} <span>Incident Lab</span></button><a href="/evidence" class="nav-link" style="text-decoration:none">${ico('shield',18)} <span>Evidence Centre</span></a><button class="nav-link" data-action="toolkit">${ico('spark',18)} <span>Agent & MCP</span></button><button class="nav-link" data-action="reset">${ico('refresh',18)} <span>Reset demo</span></button></nav><div class="sidebar-bottom"><div class="agency"><div class="agency-mark">N</div><strong>Northbank Meals</strong><span>Fictional community kitchen<br>Demo workspace</span></div><div class="sidebar-footer"><span class="side-status"></span><span>Local dispatch system</span></div></div></aside><main class="page" id="main"><div class="topline"><div class="topline-left">WORKSPACE <span class="breadcrumb-chevron">/</span> <strong style="color:var(--ink)">Operations overview</strong></div><div class="topline-actions"><span class="badge demo">${ico('shield',12)} DEMO DATA</span><button class="icon-btn" aria-label="Switch to ${dark?'light':'dark'} theme" title="Toggle theme" data-action="theme">${ico(dark?'sun':'moon',16)}</button><span class="badge"><span class="dot"></span> SYSTEM READY</span></div></div><header class="greeting"><div><div class="eyebrow">THURSDAY DELIVERY SHIFT <span style="color:#abb7ab;padding:0 5px">/</span> 09:00–13:00</div><h1>${s.mode==='committed'?'Back on track.':s.mode==='proposed'?'A way forward.':'Every delivery matters.'}</h1><p>${s.mode==='normal'?'Your community is counting on you. Let’s keep every promise on the map.':s.mode==='proposed'?'One cancellation. A complete recovery plan — ready for your decision.':'Recovery approved. Your updated driver schedules are ready.'}</p></div><div style="display:flex;gap:9px"><button class="primary-btn" data-action="launch-lab">${ico('spark',15)} Enter Incident Lab</button><button class="outline-btn" data-action="reset">${ico('refresh',15)} Reset scenario</button></div></header>${banner()}${metrics()}<div class="workspace"><div>${mapMarkup()}${crewMarkup()}</div>${copilotMarkup()}</div><div class="bottom-note">${ico('shield',15)} Built for transparent decisions. Fictional locations, real optimisation, human approval. MCP v2025-11-25.</div></main></div>`;
 const input=document.getElementById('command');if(input&&lastCommand&&!s.proposal)input.value='';
}
async function runRescue(command){if(isBusy)return;lastCommand=command;isBusy=true;errorText='';render();try{const answer=await api('/api/rescue','POST',{command});appState=answer.state;trace=answer.trace;selectedStop=null;showOriginal=false;toast('Constraint checks completed. Review the plan.');}catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}}
async function perform(action,button){if(isBusy)return;
 if(action.startsWith('lab-')||action.startsWith('twin-')||action==='launch-lab')return performLab(action,button);
 if(action==='rescue')return runRescue('Sam is unavailable. Rescue today’s deliveries.');
 if(action==='original'){showOriginal=true;render();return;}
 if(action==='proposed'){showOriginal=false;render();return;}
 if(action==='export'){window.location.href='/api/export';toast('Driver schedules exported as CSV');return;}
 if(action==='export-proof'){window.location.href='/api/certificate';toast('Self-contained recovery certificate downloaded. Verify using node scripts/verify-certificate.js');return;}
 if(action==='roster'){document.querySelector('.drivers')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
 if(action==='toolkit'){document.getElementById('assistant-history')?.scrollIntoView({behavior:'smooth'});toast('MCP endpoint: http://127.0.0.1:4173/mcp');return;}
 if(action==='theme'){dark=!dark;document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('rr-theme',dark?'dark':'light');}catch{}render();return;}
 if(!['approve','undo','reset'].includes(action))return;
 isBusy=true;errorText='';render();try{
  const endpoint=action==='approve'?'/api/commit':action==='undo'?'/api/undo':'/api/reset';
  const approval=action==='approve'?await api('/api/approval','POST',{proposalId:appState.proposal.id,expectedVersion:appState.version}):null;
  const rollback=action==='undo'?await api('/api/rollback-approval','POST',{expectedVersion:appState.version}):null;
  const payload=action==='approve'?{proposalId:appState.proposal.id,approvalToken:approval.token}:action==='undo'?{rollbackToken:rollback.token}:{};
  const result=await api(endpoint,'POST',payload);appState=result.state;if(action!=='approve'){trace=[];lastCommand='';selectedStop=null;showOriginal=false;}toast(action==='approve'?'Rescue approved! Schedules updated.':action==='undo'?'Original schedules restored.':'Fresh demo scenario loaded.');
 }catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}
}
document.addEventListener('change',event=>{
 const key=event.target.dataset.twinSetting;
 if(!key)return;
 const value=['backupCapacity','extendWindows','shiftEnd'].includes(key)?Number(event.target.value):event.target.value;
 const focusId=event.target.id;twinConfig={...twinConfig,[key]:value};twinResult=null;twinIntervention=null;twinStageConfirm=false;render();document.getElementById(focusId)?.focus();
});
document.addEventListener('click',event=>{const btn=event.target.closest('[data-action]');if(btn){event.preventDefault();perform(btn.dataset.action,btn);return;}const stop=event.target.closest('[data-stop]');if(stop){selectedStop=selectedStop===stop.dataset.stop?null:stop.dataset.stop;render();}});
document.addEventListener('keydown',event=>{const stop=event.target.closest?.('[data-stop]');if(stop&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectedStop=stop.dataset.stop;render();}});
document.addEventListener('submit',event=>{if(event.target.id==='lab-agent-form'){event.preventDefault();const text=event.target.querySelector('input').value.trim();if(text)askAgent(text);return;}if(event.target.id!=='command-form')return;event.preventDefault();const text=event.target.querySelector('input').value.trim();if(text)runRescue(text);});
function showLogin(){
 root.innerHTML=`<main class="rr-login"><div class="rr-login-card"><div class="rr-login-mark"><img src="/logo.svg" alt="" width="55" height="55"><span>ROUTERESCUE / SECURED WORKSPACE</span></div><h1>Continue your<br>recovery mission.</h1><p>Coordinator sessions keep operational changes attributable to a person. The default fictional demo needs no login.</p><form id="rr-login-form"><label for="rr-username">Coordinator username</label><input id="rr-username" name="username" autocomplete="username" required minlength="2"><label for="rr-password">Password</label><input id="rr-password" name="password" type="password" autocomplete="current-password" required><div class="rr-login-error" id="rr-login-error" role="alert" aria-live="polite"></div><button type="submit">Open secure workspace ↗</button></form><small>Sessions expire after two hours · HttpOnly session cookie · no third-party login provider</small></div></main>`;
 document.getElementById('rr-login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
  try{const fields=new FormData(form);await api('/api/login','POST',{username:fields.get('username'),password:fields.get('password')});appState=await api('/api/state');labOpen=Boolean(appState.lab);render();}
  catch(error){document.getElementById('rr-login-error').textContent=error.message;button.disabled=false;}
 });
}
(async()=>{try{appState=await api('/api/state');labOpen=Boolean(appState.lab);render();}catch(e){if(e.status===401){showLogin();return;}root.innerHTML=`<div class="boot"><img src="/logo.svg" alt="RouteRescue" width="64" height="64"><h1>Can't reach local dispatch</h1><p>${esc(e.message)}. Check that start.bat or node server/index.js is running.</p><button class="primary-btn" id="retry">Retry connection</button></div>`;document.getElementById('retry').onclick=()=>location.reload();}})();
/** Hypothetical MCP tools have no commit privileges or side effects. */
function twinOptions(){return {blocked:[...twinConfig.blocked],backupCapacity:twinConfig.backupCapacity,extendWindows:twinConfig.extendWindows,shiftChanges:twinConfig.shiftDriver?{[twinConfig.shiftDriver]:twinConfig.shiftEnd}:{},strategy:twinConfig.strategy};}
async function runTwin(){if(isBusy)return;isBusy=true;errorText='';render();try{twinResult=await api('/api/twin','POST',{expectedVersion:appState.version,options:twinOptions()});toast('Counterfactual independently validated. Live dispatch unchanged.');}catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}}
async function runIntervention(){if(isBusy)return;isBusy=true;errorText='';render();try{const options={blocked:[...twinConfig.blocked],strategy:twinConfig.strategy,allowWindowFlex:false,budget:8,maxBackupCapacity:16};twinIntervention=await api('/api/interventions','POST',{expectedVersion:appState.version,options});toast(twinIntervention.winner?'Verified intervention discovered. No live changes.':'Search completed without a full recovery.');}catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}}
async function runRisk(){if(isBusy)return;isBusy=true;errorText='';render();try{twinRisk=await api('/api/resilience','POST',{expectedVersion:appState.version});toast('Resilience sweep complete. No operational changes.');}catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}}
async function saveTwinEvidence(){if(!twinResult||isBusy)return;isBusy=true;errorText='';render();try{
 const response=await fetch('/api/twin/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:appState.version,options:twinOptions()})});
 if(!response.ok){const data=await response.json();throw Error(data.error||'Evidence export failed');}
 const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='routerescue-what-if-evidence.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Scenario evidence downloaded. Verification script in the project.');
 }catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}}
/** Incident Lab controller: all transformations come from backend state, never fabricated UI data. */
async function performLab(action,button){
 if(action==='lab-agent-example')return askAgent(button.dataset.example);
 if(action==='twin-enter'){twinOpen=true;labOpen=true;twinConfig.blocked=[...(appState.unavailableDriverIds||[])];twinResult=null;twinIntervention=null;twinRisk=null;errorText='';render();return;}
 if(action==='twin-to-incident'){twinOpen=false;errorText='';render();return;}
 if(action==='twin-toggle'){const id=button.dataset.driver;twinConfig.blocked=twinConfig.blocked.includes(id)?twinConfig.blocked.filter(x=>x!==id):[...twinConfig.blocked,id];twinResult=null;twinIntervention=null;twinStageConfirm=false;render();return;}
 if(action==='twin-crisis'){twinConfig={blocked:['sam','priya','leo','maya'],backupCapacity:0,extendWindows:0,shiftDriver:'',shiftEnd:780,strategy:'priority'};twinResult=null;twinIntervention=null;return runTwin();}
 if(action==='twin-risk-load'){twinConfig.blocked=[...(appState.unavailableDriverIds||[]),button.dataset.driver].filter((x,i,a)=>a.indexOf(x)===i);twinResult=null;twinIntervention=null;return runTwin();}
 if(action==='twin-policy'){twinConfig.strategy=button.dataset.policy;twinResult=null;twinIntervention=null;return runTwin();}
 if(action==='twin-run')return runTwin();
 if(action==='twin-intervention')return runIntervention();
 if(action==='twin-risk')return runRisk();
 if(action==='twin-history'){try{twinForensic=await api('/api/checkpoints');errorText='';}catch(e){errorText=e.message;}render();return;}
 if(action==='twin-evidence')return saveTwinEvidence();
 if(action==='twin-stage-review'){twinStageConfirm=true;render();return;}
 if(action==='twin-stage-cancel'){twinStageConfirm=false;render();return;}
 if(action==='twin-stage-confirm'){
  if(isBusy)return;
  isBusy=true;errorText='';render();
  try{
   const result=await api('/api/twin/stage','POST',{expectedVersion:appState.version,options:twinOptions(),acknowledged:true});
   appState=result.state;trace=result.trace;twinOpen=false;twinResult=null;twinStageConfirm=false;labOpen=true;showOriginal=false;
   toast('Confirmed facts staged. Review and separately approve the newly computed plan.');
  }catch(e){errorText=e.message;toast(e.message,'error');}
  finally{isBusy=false;render();}
  return;
 }
 if(action==='lab-overview'){labOpen=false;twinOpen=false;render();return;}
 if(action==='lab-original'){showOriginal=true;render();return;}
 if(action==='lab-proposed'){showOriginal=false;render();return;}
 if(action==='lab-audit'){
  auditOpen=!auditOpen;
  if(auditOpen){try{const x=await api('/api/audit');auditProof=x.verification;}catch(e){errorText=e.message;}}
  render();return;
 }
 isBusy=true;errorText='';render();
 try{
  if(action==='launch-lab'||action==='lab-reset'){
   const r=await api('/api/lab','POST',{});appState=r.state;labOpen=true;twinOpen=false;twinResult=null;twinIntervention=null;twinRisk=null;twinForensic=null,twinStageConfirm=false;agentReply='';showOriginal=false;selectedStop=null;trace=[];auditProof=null;auditOpen=false;
  }else if(action==='lab-toggle'){
   const wasProposed=appState.mode==='proposed';const r=await api('/api/incident','POST',{driverId:button.dataset.driver});appState=r.state;showOriginal=false;
   if(wasProposed&&appState.unavailableDriverIds.length){const p=await api('/api/plan','POST',{});appState=p.state;trace=p.trace;}
   else trace=[];
  }else if(action==='lab-preset'){
   const preset=button.dataset.preset,selection={first:['sam'],cascade:['sam','priya'],critical:['sam','priya','leo','maya']}[preset];
   if(!selection)throw Error('Unknown scenario');
   const current=appState.unavailableDriverIds||[];
   for(const id of [...new Set([...current,...selection])]){
    if(current.includes(id)===selection.includes(id))continue;
    const r=await api('/api/incident','POST',{driverId:id});appState=r.state;
   }
   const p=await api('/api/plan','POST',{});appState=p.state;trace=p.trace;showOriginal=false;
  }else if(action==='lab-plan'){
   const r=await api('/api/plan','POST',{});appState=r.state;trace=r.trace;showOriginal=false;
  }else if(action==='lab-select'){
   if(appState.selectedStrategy!==button.dataset.strategy){const r=await api('/api/select','POST',{strategy:button.dataset.strategy,expectedVersion:appState.version});appState=r.state;trace=[...trace,...r.trace];}
  }else if(action==='lab-approve'){
   const approval=await api('/api/approval','POST',{proposalId:appState.proposal.id,expectedVersion:appState.version});
   const result=await api('/api/commit','POST',{proposalId:appState.proposal.id,approvalToken:approval.token});appState=result.state;trace=[...trace,...result.trace];
   toast('Exact approved plan committed. Audit chain updated.');
  }else if(action==='lab-undo'){
   const token=await api('/api/rollback-approval','POST',{expectedVersion:appState.version});const result=await api('/api/undo','POST',{rollbackToken:token.token});appState=result.state;trace=[...trace,{tool:'undo_rescue',label:'Exact dispatch snapshot restored',detail:'Original routes and driver availability restored'}];showOriginal=false;
  }
  if(auditOpen){const r=await api('/api/audit');auditProof=r.verification;}
 }catch(e){errorText=e.message;toast(e.message,'error');}
 finally{isBusy=false;render();}
}

async function askAgent(command){if(isBusy)return;isBusy=true;agentReply='';errorText='';render();try{
 const result=await api('/api/agent','POST',{command});appState=result.state;trace=[...trace,...result.trace];agentReply=result.reply;showOriginal=false;
 toast('Agent reasoning grounded in the current dispatch state.');
 }catch(e){errorText=e.message;toast(e.message,'error');}finally{isBusy=false;render();}
}
