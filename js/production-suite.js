/* XE3AGLE v20 — legacy suite; media uses Firebase shim (local-only) */
import { SyncManager } from './auth/sync-manager.js';
import { AuthManager } from './auth/auth-manager.js';
import { storage, ref, uploadBytes, getDownloadURL } from './firebase-client.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{try{return window.formatCurrency?window.formatCurrency(Number(v)||0,window.state?.settings?.currency||'USD'):(Number(v)||0).toFixed(2)}catch{return String(v)}};
let initialized=false;

function toast(m,t='info'){window.toast?.(m,t);}
function trades(){return Array.isArray(window.state?.trades)?window.state.trades:[];}
function save(){window.saveState?.();}
function addStyle(){if($('xe-production-style'))return;const s=document.createElement('style');s.id='xe-production-style';s.textContent=`
.xe-prod-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.xe-prod-card{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px}.xe-prod-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em}.xe-prod-value{font-size:20px;font-weight:800;margin-top:5px;font-family:'SF Mono','Consolas',monospace}.xe-prod-muted{font-size:11px;color:var(--text3)}.xe-prod-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.xe-prod-toolbar input,.xe-prod-toolbar select{min-height:34px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:0 9px}.xe-prod-account-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}.xe-prod-account-row:last-child{border-bottom:0}.xe-prod-account-row.active{background:var(--green-bg);border-radius:8px;padding-left:9px;padding-right:9px}.xe-prod-dot{width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;margin-right:6px}.xe-prod-table{width:100%;border-collapse:collapse;font-size:12px}.xe-prod-table th,.xe-prod-table td{padding:8px;border-bottom:1px solid var(--border);text-align:left}.xe-prod-table th{color:var(--text3);font-size:10px;text-transform:uppercase}.xe-prod-equity{width:100%;height:220px;background:var(--surface2);border:1px solid var(--border);border-radius:9px}.xe-prod-status{font-size:11px;padding:5px 8px;border-radius:999px;display:inline-flex}.xe-prod-status.ok{background:var(--green-bg);color:var(--green)}.xe-prod-status.warn{background:var(--amber-bg);color:var(--amber)}.xe-prod-status.bad{background:var(--red-bg);color:var(--red)}.xe-prod-modal{position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:18px}.xe-prod-modal>div{width:min(440px,100%);background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:20px;box-shadow:0 20px 80px rgba(0,0,0,.55)}.xe-prod-modal input,.xe-prod-modal select{width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;margin-top:6px}.xe-prod-modal label{display:block;font-size:11px;color:var(--text2);margin-top:12px}.xe-upload-zone{border:1px dashed var(--border2);border-radius:9px;padding:16px;text-align:center;background:var(--surface2)}
@media(max-width:600px){.xe-prod-account-row{grid-template-columns:1fr auto}.xe-prod-account-row .account-type{display:none}.xe-prod-table{min-width:620px}.xe-prod-toolbar>*{width:100%}}
`;document.head.appendChild(s)}

function currentAccount(){return window.state?.accountMeta?.name||'Main Account'}
function freshAccount(name,type){
 const base=structuredClone(window.state||{});
 base.accountId='acct-'+crypto.randomUUID();base.accountMeta={name,type};
 base.trades=[];base.dailyHistory=[];base.activeTrade=null;base.lastTradeReview=null;base.killSwitch=false;base.killReason='';base.workflowStage='prepare';
 base.preparation={emotion:'',focus:'',news:'',markets:'',rulesAccepted:false};
 base.analysis={biasDir:'',biasHTF:'',biasETF:'',biasNotes:'',liquidity:[],liquidityNotes:'',sweep:false,sweepNotes:'',mss:false,mssNotes:'',entryModel:'',direction:'',entry:'',sl:'',tp:'',ptval:base.settings?.ptval||''};
 base.reviewAnswers={};base.screenshotData=null;base.dailyStart=null;base.dailyReview={};base.psychology={reflection:''};base.psychologyHistory=[];
 base.sync={modifiedAt:Date.now(),lastSyncedAt:0,status:'local'};
 return base;
}

async function refreshAccounts(){
 if(!AuthManager.currentUser)return [];
 const list=await SyncManager.listAccounts(AuthManager.currentUser);
 if(!list.length){const a=await SyncManager.ensureDefaultAccount(AuthManager.currentUser,window.state);return [a];}
 return list;
}

async function switchAccount(id){
 if(!id||id===window.state?.accountId)return;
 try{
   await window.xe3agleSync?.();
   const remote=await SyncManager.pull(AuthManager.currentUser,id);
   if(!remote?.payload){toast('Account data could not be loaded.','error');return;}
   window.state=window.migrateState?window.migrateState(remote.payload):remote.payload;
   window.state.accountId=id;window.state.sync=window.state.sync||{};window.state.sync.lastSyncedAt=remote.clientModifiedAt||0;window.state.sync.status='synced';
   localStorage.setItem('xe3agle_state',JSON.stringify(window.state));
   window.renderAll?.();window.renderAllV10?.();renderAccountManager();
   toast('Switched to '+(window.state.accountMeta?.name||id)+'.','success');
 }catch(e){toast('Could not switch account safely.','error')}
}

async function createAccount(){
 const form=await modal('Create Trading Account',`<label>Account name<input id="xe-prod-new-name" maxlength="40" placeholder="e.g. FTMO Challenge"></label><label>Account type<select id="xe-prod-new-type"><option>FUNDED</option><option>PERSONAL</option><option>DEMO</option></select></label>`,'Create');
 if(!form)return;
 const name=$('xe-prod-new-name')?.value.trim();const type=$('xe-prod-new-type')?.value||'FUNDED';if(!name)return toast('Enter an account name.','error');
 try{
   await window.xe3agleSync?.();
   const fresh=freshAccount(name,type);window.state=fresh;localStorage.setItem('xe3agle_state',JSON.stringify(fresh));
   await SyncManager.push(AuthManager.currentUser,fresh,fresh.accountId,{force:true});window.renderAll?.();window.renderAllV10?.();renderAccountManager();toast('Account created.','success');
 }catch(e){toast('Account creation failed. Your current account was preserved.','error')}
}

function modal(title,body,ok='Save'){
 return new Promise(resolve=>{const wrap=document.createElement('div');wrap.className='xe-prod-modal';wrap.innerHTML=`<div><div class="modal-title">${esc(title)}</div><div>${body}</div><div class="btn-group mt16"><button class="btn btn-primary" id="xe-prod-ok">${esc(ok)}</button><button class="btn" id="xe-prod-cancel">Cancel</button></div></div>`;document.body.appendChild(wrap);const close=v=>{wrap.remove();resolve(v)};wrap.querySelector('#xe-prod-ok').onclick=()=>close(true);wrap.querySelector('#xe-prod-cancel').onclick=()=>close(false);});
}

async function renderAccountManager(){
 const host=$('xe-account-manager');if(!host)return;
 let list=[];try{list=await refreshAccounts()}catch{}
 host.innerHTML=`<div class="card-title">TRADING ACCOUNTS</div><div class="text-xs text-muted mb12">Keep funded, personal and demo accounts isolated. Each account has its own balance, journal, limits and analytics.</div><div id="xe-account-list">${list.map(a=>`<div class="xe-prod-account-row ${a.id===window.state?.accountId?'active':''}"><div><span class="xe-prod-dot"></span><strong>${esc(a.name||a.id)}</strong><div class="xe-prod-muted">${esc(a.type||'ACCOUNT')} • ${esc(a.currency||'USD')}</div></div><span class="account-type xe-prod-muted">${a.id===window.state?.accountId?'ACTIVE':'READY'}</span><button class="btn btn-sm" ${a.id===window.state?.accountId?'disabled':''} data-switch-account="${esc(a.id)}">Open</button></div>`).join('')}</div><button class="btn btn-primary btn-sm mt12" id="xe-new-account">+ New account</button>`;
 host.querySelectorAll('[data-switch-account]').forEach(b=>b.onclick=()=>switchAccount(b.dataset.switchAccount));$('xe-new-account').onclick=createAccount;
}

function injectFeedback(){
 const settings=$('page-settings');if(!settings||$('xe-feedback-card'))return;const card=document.createElement('div');card.className='card';card.id='xe-feedback-card';card.innerHTML=`<div class="card-title">FEEDBACK / FEATURE REQUEST</div><div class="text-xs text-muted mb12">Tell us what should be improved. This is saved to your authenticated XE3AGLE account.</div><div class="field-row col2"><div class="field"><label>Category</label><select id="xe-feedback-category"><option>FEATURE</option><option>BUG</option><option>UX</option><option>PERFORMANCE</option><option>OTHER</option></select></div><div class="field"><label>Message</label><textarea id="xe-feedback-message" maxlength="4000" placeholder="What should XE3AGLE improve?"></textarea></div></div><button class="btn btn-primary btn-sm mt8" id="xe-feedback-send">Send feedback</button>`;settings.appendChild(card);$('xe-feedback-send').onclick=async()=>{const m=$('xe-feedback-message').value.trim();if(!m)return toast('Write some feedback first.','error');try{await window.xe3agleSendFeedback($('xe-feedback-category').value,m);$('xe-feedback-message').value='';toast('Feedback sent.','success')}catch(e){toast('Feedback could not be sent.','error')}};
}

function injectSettings(){
 const settings=$('page-settings');if(!settings||$('xe-account-manager'))return;
 const card=document.createElement('div');card.className='card';card.id='xe-account-manager';settings.prepend(card);
 const security=document.createElement('div');security.className='card';security.id='xe-security-card';security.innerHTML=`<div class="card-title">ACCOUNT SECURITY</div><div class="xe-prod-toolbar"><button class="btn btn-sm" id="xe-verify-email">Send verification email</button><button class="btn btn-sm" id="xe-export-all">Export my data</button><button class="btn btn-danger btn-sm" id="xe-delete-account">Delete account</button></div><div id="xe-security-status" class="text-xs text-muted mt8"></div>`;settings.insertBefore(security,settings.children[1]||null);
 $('xe-verify-email').onclick=async()=>{try{await AuthManager.verifyEmail();$('xe-security-status').textContent='Verification email sent.';toast('Verification email sent.','success')}catch(e){toast(e.message||'Could not send verification email.','error')}};
 $('xe-export-all').onclick=()=>exportJSON();$('xe-delete-account').onclick=deleteAccount;
 renderAccountManager();
}

async function deleteAccount(){
 if(!AuthManager.currentUser)return;
 const ok=await modal('Delete XE3AGLE account',`<div class="alert alert-red">This signs you out and removes the current account's cloud state. Export your data first if you need a backup.</div><label>Type DELETE<input id="xe-prod-delete-confirm" autocomplete="off"></label>`,'Delete permanently');
 if(!ok||$('xe-prod-delete-confirm')?.value!=='DELETE'){if(ok)toast('Deletion cancelled: confirmation text did not match.','error');return}
 try{await window.xe3agleSync?.();const accounts=await SyncManager.listAccounts(AuthManager.currentUser);for(const a of accounts)await SyncManager.deleteAccountData(AuthManager.currentUser,a.id);await AuthManager.deleteAccount();localStorage.removeItem('xe3agle_state');location.reload();}catch(e){toast('Account deletion requires a recent login. Please sign in again and retry.','error')}
}

function exportJSON(){
 const payload={exportedAt:new Date().toISOString(),product:'XE3AGLE',schemaVersion:window.state?._schemaVersion||16,account:window.state?.accountMeta||{},state:window.state};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});download(blob,'xe3agle-data-backup.json');toast('Full account backup exported.','success');
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function filteredTrades(){
 const q=$('xe-journal-search')?.value.trim().toLowerCase()||'';const result=$('xe-journal-result')?.value||'ALL';const dir=$('xe-journal-direction')?.value||'ALL';const type=$('xe-journal-type')?.value||'ALL';
 return trades().filter(t=>(!q||JSON.stringify(t).toLowerCase().includes(q))&&(result==='ALL'||t.result===result)&&(dir==='ALL'||t.direction===dir)&&(type==='ALL'||(t.tradeType||'HISTORICAL')===type));
}
function renderJournalEnhancements(){
 const page=$('page-journal');if(!page||$('xe-journal-enhanced'))return;
 const card=document.createElement('div');card.className='card';card.id='xe-journal-enhanced';card.innerHTML=`<div class="flex-between"><div><div class="card-title mb0">JOURNAL CONTROL</div><div class="text-xs text-muted">Search, filter and export your trade history.</div></div><span class="xe-prod-status ok" id="xe-journal-count">0 trades</span></div><div class="xe-prod-toolbar mt12"><input id="xe-journal-search" placeholder="Search setup, notes, session…"><select id="xe-journal-type"><option>ALL</option><option>LIVE</option><option>HISTORICAL</option></select><select id="xe-journal-result"><option>ALL</option><option>WIN</option><option>LOSS</option><option>BREAKEVEN</option></select><select id="xe-journal-direction"><option>ALL</option><option>LONG</option><option>SHORT</option></select><button class="btn btn-sm" id="xe-journal-export">Export filtered CSV</button><button class="btn btn-sm" id="xe-journal-xlsx">Export XLSX</button></div>`;
 page.prepend(card);['xe-journal-search','xe-journal-type','xe-journal-result','xe-journal-direction'].forEach(id=>$(id).addEventListener('input',renderJournalFilterCount));$('xe-journal-export').onclick=()=>exportFilteredCSV();$('xe-journal-xlsx').onclick=exportXLSX;renderJournalFilterCount();
}
function renderJournalFilterCount(){const n=filteredTrades().length;if($('xe-journal-count'))$('xe-journal-count').textContent=n+' trade'+(n===1?'':'s')}
function exportFilteredCSV(){const ts=filteredTrades();const fields=['date','time','tradeType','direction','entry','sl','tp','rr','riskPct','riskAmount','positionSize','setup','session','result','resultR','resultPL','emotion','discipline','violations','notes'];const escv=v=>'"'+String(Array.isArray(v)?v.join('|'):v??'').replace(/"/g,'""')+'"';const csv=[fields.join(','),...ts.map(t=>fields.map(f=>escv(t[f])).join(','))].join('\n');download(new Blob([csv],{type:'text/csv'}),'xe3agle-filtered-trades.csv');toast('Filtered CSV exported.','success')}

function performanceData(){
 const ts=[...trades()].sort((a,b)=>new Date((a.closedAt||a.date+'T'+(a.time||'00:00:00')))-new Date((b.closedAt||b.date+'T'+(b.time||'00:00:00'))));let bal=Number(window.state?.settings?.balance)||0;let peak=bal;return ts.map(t=>{bal+=Number(t.resultPL)||0;peak=Math.max(peak,bal);return {date:t.date,balance:bal,drawdown:peak-bal,r:Number(t.resultR)||0}})
}
function drawEquity(canvas){
 if(!canvas)return;const ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||220;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const data=performanceData();if(!data.length){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text3');ctx.font='12px sans-serif';ctx.fillText('No closed trades yet.',16,28);return}const vals=data.map(x=>x.balance),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.beginPath();ctx.moveTo(12,h-24);ctx.lineTo(w-12,h-24);ctx.stroke();ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--green');ctx.lineWidth=2;ctx.beginPath();data.forEach((p,i)=>{const x=12+(w-24)*(i/Math.max(1,data.length-1)),y=12+(h-42)*(1-(p.balance-min)/range);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
function renderAdvancedAnalytics(){
 const page=$('page-analytics');if(!page||$('xe-advanced-analytics'))return;
 const card=document.createElement('div');card.className='card';card.id='xe-advanced-analytics';card.innerHTML=`<div class="flex-between"><div><div class="card-title mb0">PERFORMANCE LAB</div><div class="text-xs text-muted">Account-level equity, drawdown and behavior breakdown.</div></div><button class="btn btn-sm" id="xe-refresh-analytics">Refresh</button></div><div class="xe-prod-grid mt12" id="xe-prod-metrics"></div><canvas id="xe-prod-equity" class="xe-prod-equity mt12" aria-label="Equity curve"></canvas><div class="xe-prod-grid mt12" id="xe-prod-breakdown"></div>`;
 page.appendChild(card);$('xe-refresh-analytics').onclick=renderAdvancedAnalyticsData;renderAdvancedAnalyticsData();
}
function renderAdvancedAnalyticsData(){
 const ts=trades();const n=ts.length,w=ts.filter(t=>t.result==='WIN').length,l=ts.filter(t=>t.result==='LOSS').length;const pl=ts.reduce((a,t)=>a+(Number(t.resultPL)||0),0);const rs=ts.map(t=>Number(t.resultR)||0);const avg=rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:0;const discipline=ts.length?ts.reduce((a,t)=>a+(Number(t.discipline)||0),0)/ts.length:0;const eq=performanceData();const dd=eq.reduce((m,x)=>Math.max(m,x.drawdown),0);const expectancy=ts.length?((w/n)*(rs.filter(x=>x>0).reduce((a,b)=>a+b,0)/(rs.filter(x=>x>0).length||1))+(l/n)*(rs.filter(x=>x<0).reduce((a,b)=>a+b,0)/(rs.filter(x=>x<0).length||1))):0;
 const holding=ts.map(t=>{const a=new Date(t.plannedAt||t.openedAt||t.date+'T'+(t.time||'00:00:00')),b=new Date(t.closedAt||t.date+'T'+(t.time||'00:00:00'));return Math.max(0,(b-a)/60000)}).filter(Number.isFinite);const avgHold=holding.length?holding.reduce((a,b)=>a+b,0)/holding.length:0;
 const metrics=[['Trades',n],['Win rate',n?(w/n*100).toFixed(1)+'%':'—'],['Total P/L',money(pl)],['Average R',(avg>=0?'+':'')+avg.toFixed(2)+'R'],['Expectancy',(expectancy>=0?'+':'')+expectancy.toFixed(2)+'R'],['Max DD',money(-dd)],['Discipline',discipline?discipline.toFixed(1)+'%':'—'],['Avg hold',avgHold?Math.round(avgHold)+' min':'—']];if($('xe-prod-metrics'))$('xe-prod-metrics').innerHTML=metrics.map(x=>`<div class="xe-prod-card"><div class="xe-prod-label">${esc(x[0])}</div><div class="xe-prod-value">${esc(x[1])}</div></div>`).join('');
 const groupTable=(title,keyFn)=>{const groups={};ts.forEach(t=>{const k=keyFn(t)||'Unspecified';(groups[k]??=[]).push(t)});const rows=Object.entries(groups).map(([k,a])=>`<tr><td>${esc(k)}</td><td>${a.length}</td><td>${(a.filter(t=>t.result==='WIN').length/a.length*100).toFixed(1)}%</td><td>${a.reduce((s,t)=>s+(Number(t.resultR)||0),0).toFixed(2)}R</td><td>${money(a.reduce((s,t)=>s+(Number(t.resultPL)||0),0))}</td></tr>`).join('');return `<div class="xe-prod-card"><div class="card-title">${title}</div><div style="overflow:auto"><table class="xe-prod-table"><thead><tr><th>Group</th><th>Trades</th><th>Win Rate</th><th>Total R</th><th>P/L</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No trade data.</td></tr>'}</tbody></table></div></div>`};
 const now=new Date();const keyDate=t=>new Date((t.closedAt||t.date+'T12:00:00'));const dayStart=new Date(now);dayStart.setHours(0,0,0,0);const weekStart=new Date(now);weekStart.setDate(now.getDate()-((now.getDay()+6)%7));weekStart.setHours(0,0,0,0);const monthStart=new Date(now.getFullYear(),now.getMonth(),1);const period=(start)=>ts.filter(t=>keyDate(t)>=start);const summary=(label,a)=>`<div class="xe-prod-card"><div class="xe-prod-label">${label}</div><div class="xe-prod-value">${money(a.reduce((s,t)=>s+(Number(t.resultPL)||0),0))}</div><div class="xe-prod-muted">${a.length} trades • ${a.reduce((s,t)=>s+(Number(t.resultR)||0),0).toFixed(2)}R</div></div>`;
 if($('xe-prod-breakdown'))$('xe-prod-breakdown').innerHTML=`${summary('Today',period(dayStart))}${summary('This Week',period(weekStart))}${summary('This Month',period(monthStart))}${groupTable('Performance by Setup',t=>t.setup||t.entryModel)}${groupTable('Performance by Session',t=>t.session)}${groupTable('Long vs Short',t=>t.direction)}${groupTable('Performance by Day',t=>keyDate(t).toLocaleDateString(undefined,{weekday:'long'}))}<div class="xe-prod-card" style="grid-column:1/-1"><div class="card-title">Review Prompts</div><div class="xe-prod-muted">What did I do well? What did I violate? What is one concrete change for tomorrow? Record these in Daily Review before ending the session.</div></div>`;drawEquity($('xe-prod-equity'));
}

async function uploadTradeScreenshot(file,tradeId,stage='journal'){
 if(!file||!storage||!AuthManager.currentUser)return null;if(!file.type.startsWith('image/'))throw new Error('IMAGE_REQUIRED');if(file.size>9*1024*1024)throw new Error('IMAGE_TOO_LARGE');
 const path=`users/${AuthManager.currentUser.uid}/accounts/${window.state.accountId||'main'}/trades/${tradeId}/${stage}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const snap=await uploadBytes(ref(storage,path),file,{contentType:file.type,cacheControl:'public,max-age=31536000'});return getDownloadURL(snap.ref);
}
async function enhanceScreenshotUpload(){
 const input=$('t-screenshot');if(!input||input.dataset.cloudBound)return;input.dataset.cloudBound='1';input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{const tradeId=window.state?.tradeEditId||'pending-'+Date.now();const url=await uploadTradeScreenshot(file,tradeId,'journal');if(url){window.state.screenshotData=url;window.state.screenshotCloudUrl=url;save();toast('Screenshot uploaded to your account.','success')}}catch(e){toast(e.message==='IMAGE_TOO_LARGE'?'Screenshot must be under 9 MB.':'Screenshot upload failed. The local copy remains available.','error')}});
}

async function ensureXLSX(){
 if(window.XLSX)return window.XLSX;
 if(document.getElementById('xe-xlsx-loader')){await new Promise(r=>document.getElementById('xe-xlsx-loader').addEventListener('load',r,{once:true}));return window.XLSX||null;}
 return new Promise(resolve=>{const sc=document.createElement('script');sc.id='xe-xlsx-loader';sc.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';sc.onload=()=>resolve(window.XLSX||null);sc.onerror=()=>resolve(null);document.head.appendChild(sc);});
}
async function exportXLSX(){
 const ts=filteredTrades();const x=await ensureXLSX();
 if(!x){toast('XLSX library unavailable. CSV is available instead.','error');return;}
 const rows=ts.map(t=>({Date:t.date,Time:t.time,Type:t.tradeType||'HISTORICAL',Direction:t.direction,Entry:t.entry,SL:t.sl,TP:t.tp,RR:t.rr,RiskPct:t.riskPct,RiskAmount:t.riskAmount,PositionSize:t.positionSize,Setup:t.setup||t.entryModel,Session:t.session,Result:t.result,ResultR:t.resultR,PnL:t.resultPL,Emotion:t.emotion,Discipline:t.discipline,Violations:Array.isArray(t.violations)?t.violations.join('; '):t.violations||'',Notes:t.notes||''}));
 const wb=x.utils.book_new();const ws=x.utils.json_to_sheet(rows);x.utils.book_append_sheet(wb,ws,'Trades');x.writeFile(wb,'xe3agle-trades.xlsx');toast('Real XLSX file exported.','success');
}

function installAuditGuards(){
 if(window.__xeAuditInstalled)return;window.__xeAuditInstalled=true;window.state.auditLog=Array.isArray(window.state.auditLog)?window.state.auditLog:[];
 const record=(action,detail)=>{window.state.auditLog=window.state.auditLog||[];window.state.auditLog.push({id:Date.now().toString(),at:new Date().toISOString(),action,detail:detail||''});window.state.auditLog=window.state.auditLog.slice(-500);save();};
 ['activateKillSwitch','deactivateKillSwitch','confirmResetSession'].forEach(name=>{const fn=window[name];if(typeof fn!=='function')return;window[name]=function(){record('RULE_ACTION',name);return fn.apply(this,arguments)}});
}
function installThreeStageScreenshots(){
 const host=$('t-screenshot')?.closest('.field');if(!host||$('xe-three-screenshots'))return;const wrap=document.createElement('div');wrap.id='xe-three-screenshots';wrap.className='field-row col3';wrap.innerHTML=`<div class="field"><label>Before Trade</label><input id="xe-shot-before" type="file" accept="image/*"></div><div class="field"><label>During Trade</label><input id="xe-shot-during" type="file" accept="image/*"></div><div class="field"><label>After Trade</label><input id="xe-shot-after" type="file" accept="image/*"></div>`;host.parentNode.insertBefore(wrap,host);host.style.opacity='.55';host.querySelector('label').textContent='Legacy screenshot (optional)';
 const old=window.saveTrade;if(typeof old!=='function'||old.__xeWrapped)return;const wrapped=async function(){const files={before:$('xe-shot-before')?.files?.[0],during:$('xe-shot-during')?.files?.[0],after:$('xe-shot-after')?.files?.[0]};old.apply(this,arguments);const t=window.state.trades?.find(x=>String(x.id)===String(window.state.tradeEditId||''))||window.state.trades?.[window.state.trades.length-1];if(!t)return;const shots={...(t.screenshots||{})};for(const [stage,file] of Object.entries(files)){if(file){try{shots[stage]=await uploadTradeScreenshot(file,t.id,stage)}catch(e){toast('Could not upload '+stage+' screenshot; local trade was still saved.','error')}}}if(Object.keys(shots).length){t.screenshots=shots;t.screenshotCloudUrl=shots.after||shots.before||shots.during;save();window.renderAll?.();} };wrapped.__xeWrapped=true;window.saveTrade=wrapped;
}

async function init(){if(initialized)return;initialized=true;addStyle();injectSettings();injectFeedback();renderJournalEnhancements();renderAdvancedAnalytics();installAuditGuards();installThreeStageScreenshots();await enhanceScreenshotUpload();}
export const ProductionSuite={init,refreshAccounts,switchAccount,createAccount,renderAdvancedAnalyticsData,exportJSON,uploadTradeScreenshot,exportXLSX};
window.XE3AGLE_PRODUCTION=ProductionSuite;
