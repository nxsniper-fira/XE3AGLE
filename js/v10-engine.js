
/* ============================================================
   XE3AGLE v10 UPGRADE LAYER
   Extends v8 without deleting its existing UI architecture.
   ============================================================ */
(function(){
  'use strict';
  const V10 = { version:10 };
  const moneyFields = ['balance','riskAmount','potentialProfit','potentialLoss','resultPL'];
  const workflow = ['prepare','rules','analysis','risk','check','active','review','journal','daily'];

  function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:NaN; }
  function today(){ return getTodayKey(); }
  function currentBalance(){
    const start=num(state.settings.balance); if(!Number.isFinite(start)) return NaN;
    const realized=state.trades.reduce((a,t)=>a+(num(t.resultPL)||0),0);
    return start+realized;
  }
  function peakBalance(){
    const start=num(state.settings.balance); if(!Number.isFinite(start)) return NaN;
    let bal=start, peak=start;
    [...state.trades].sort((a,b)=>Number(a.id)-Number(b.id)).forEach(t=>{bal += num(t.resultPL)||0; peak=Math.max(peak,bal);});
    return peak;
  }
  function dailyStartBalance(){
    if(state.dailyStart && state.dailyStart.date===state.currentDay) return num(state.dailyStart.balance);
    const prior=[...state.trades].filter(t=>t.date < state.currentDay).sort((a,b)=>Number(a.id)-Number(b.id));
    const start=num(state.settings.balance);
    let bal=start;
    for(const t of prior) bal += num(t.resultPL)||0;
    return bal;
  }
  function setWorkflow(stage){ state.workflowStage=stage; saveState(); }
  function prepComplete(){ return !!state.preparation.emotion && !!state.preparation.rulesAccepted; }
  function analysisComplete(){
    const a=state.analysis;
    return !!(a.biasDir && a.biasHTF && a.biasETF && a.liquidity?.length && a.sweep && a.mss && a.entryModel && a.direction && Number.isFinite(num(a.entry)) && Number.isFinite(num(a.sl)) && Number.isFinite(num(a.tp)) && Number.isFinite(num(a.ptval||state.settings.ptval)));
  }
  function mentalBlocked(){ return ['Angry','Greedy','Fearful','Frustrated'].includes(state.preparation.emotion); }
  function sessionInfo(){
    // XE3AGLE uses the actual New York clock, not a fixed UTC offset.
    // America/New_York automatically handles EST (UTC-5) and EDT (UTC-4).
    const tz=state.settings.timezone||'America/New_York', now=new Date();
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
    const h=+parts.find(x=>x.type==='hour').value, m=+parts.find(x=>x.type==='minute').value, sec=+parts.find(x=>x.type==='second').value;
    const mins=h*60+m+sec/60;
    const start=parseTime(state.settings.sessionStart||'07:00');
    const end=parseTime(state.settings.sessionEnd||'16:00');
    const open=start<=end ? mins>=start&&mins<=end : mins>=start||mins<=end;
    return {open,start,end,mins,tz,label:'New York'};
  }
  function parseTime(x){const m=String(x||'').match(/^(\d{1,2}):(\d{2})$/);return m?Math.min(23,+m[1])*60+Math.min(59,+m[2]):0;}

  // ----- Dynamic account/risk engine -----
  window.calcRiskValues=function(){
    try{
      const s=state.settings,a=state.analysis;
      const entry=num(a.entry),sl=num(a.sl),tp=num(a.tp),ptval=num(a.ptval||s.ptval);
      const balance=currentBalance(),riskPct=num(s.risk);
      if(![entry,sl,tp,ptval,balance,riskPct].every(Number.isFinite) || balance<=0 || riskPct<=0 || riskPct>100 || ptval<=0) return null;
      const riskAmount=balance*riskPct/100,stopDist=Math.abs(entry-sl),targetDist=Math.abs(tp-entry);
      if(stopDist<=0 || targetDist<=0) return null;
      const rr=targetDist/stopDist,positionSize=riskAmount/(stopDist*ptval);
      const isLong=a.direction==='LONG',isShort=a.direction==='SHORT';
      const slValid=isLong?sl<entry:isShort?sl>entry:false;
      const tpValid=isLong?tp>entry:isShort?tp<entry:false;
      return {balance,riskAmount,stopDist,targetDist,rr,positionSize,potentialLoss:-riskAmount,potentialProfit:riskAmount*rr,riskPct,slValid,tpValid,entry,sl,tp,ptval};
    }catch(e){return null;}
  };

  window.getStopReasons=function(){
    const s=state.settings||{}; const trades=getDailyTrades(); const consec=getConsecLosses(); const reasons=[];
    const dayStart=dailyStartBalance(); const dailyPL=getDailyPL();
    if(state.killSwitch) reasons.push('Kill switch active: '+(state.killReason||'Manual'));
    const dailyLimit=num(s.dailyLoss);
    if(Number.isFinite(dayStart)&&Number.isFinite(dailyLimit)&&dailyPL <= -(dayStart*dailyLimit/100)) reasons.push('Daily loss limit reached: '+formatCurrency(Math.abs(dayStart*dailyLimit/100),s.currency));
    if(consec>=num(s.maxConsecLoss)) reasons.push('Maximum consecutive losses reached: '+consec+'/'+s.maxConsecLoss);
    if(getDailyR()>=num(s.target)) reasons.push('Daily profit target reached: +'+s.target+'R');
    if(trades.length>=num(s.maxTrades)) reasons.push('Maximum daily trades reached: '+trades.length+'/'+s.maxTrades);
    return reasons;
  };

  window.validateTrade=function(){
    const s=state.settings||{},a=state.analysis||{},reasons=[],warnings=[],checks=[];
    const add=(label,pass,reason)=>{checks.push({label,pass});if(!pass&&reason)reasons.push(reason);};
    add('Preparation completed',prepComplete(),'Complete preparation and rule acknowledgement.');
    add('Mental state',!!a && !!state.preparation.emotion,'Record your mental state.');
    add('Rules acknowledged',!!state.preparation.rulesAccepted,'Rules must be explicitly acknowledged.');
    add('Daily limits',getStopReasons().length===0,getStopReasons()[0]);
    add('No active trade',!state.activeTrade,'An active trade must be resolved first.');
    add('Bias',!!a.biasDir && a.biasDir!=='Neutral',a.biasDir==='Neutral'?'Neutral bias is not permitted for live trading.':'Bias is required.');
    add('HTF bias',!!a.biasHTF && a.biasHTF!=='Neutral','HTF directional bias is required.');
    add('Execution bias',!!a.biasETF && a.biasETF!=='Neutral','Execution timeframe bias is required.');
    add('Liquidity',Array.isArray(a.liquidity)&&a.liquidity.length>0,'Identify at least one liquidity level.');
    add('Liquidity sweep',!!a.sweep,'Liquidity sweep must be confirmed.');
    add('MSS',!!a.mss,'MSS must be confirmed.');
    add('Entry model',!!a.entryModel,'Select an entry model.');
    add('Direction',a.direction==='LONG'||a.direction==='SHORT','Select LONG or SHORT.');
    const r=calcRiskValues();
    add('Prices',!!r,'Entry, SL, TP, point value, balance and risk must be valid.');
    if(r){
      add('Directional SL',r.slValid,r.direction==='LONG'?'LONG SL must be below entry.':'SHORT SL must be above entry.');
      add('Directional TP',r.tpValid,r.direction==='LONG'?'LONG TP must be above entry.':'SHORT TP must be below entry.');
      add('Stop distance',r.stopDist>0,'Stop distance must be greater than zero.');
      add('RR',r.rr>=num(s.minRR),'RR '+r.rr.toFixed(2)+' is below minimum '+s.minRR+'.');
      add('Risk %',r.riskPct>0&&r.riskPct<=100,'Risk percentage is invalid.');
      add('Position size',Number.isFinite(r.positionSize)&&r.positionSize>0,'Position size cannot be calculated safely.');
      const ds=dailyStartBalance(),remaining=ds*num(s.dailyLoss)/100+getDailyPL();
      add('Daily risk',remaining>=r.riskAmount,remaining<r.riskAmount?'This trade could breach the daily loss limit.':null);
    }
    const si=sessionInfo();
    if(s.sessionRestriction!==false) add('Session',si.open,'Outside configured trading window.');
    if(mentalBlocked()) warnings.push('Current emotional state is a high-risk self-reported state.');
    return {allowed:reasons.length===0,reasons,warnings,checks,risk:r};
  };
  window.canTrade=function(){const v=validateTrade();return {allowed:v.allowed,reasons:v.reasons,warnings:v.warnings,checks:v.checks};};

  // ----- Safe day reset: never delete active trade -----
  const oldCheckDayReset=window.checkDayReset;
  window.checkDayReset=function(){
    const todayKey=getTodayKey();
    if(state.currentDay===todayKey){ if(!state.dailyStart) {state.dailyStart={date:todayKey,balance:currentBalance()};saveState();} return; }
    if(state.currentDay){ const prev=state.trades.filter(t=>t.date===state.currentDay); if(prev.length&&!state.dailyHistory.find(d=>d.date===state.currentDay)) archiveDay(state.currentDay); }
    state.currentDay=todayKey;
    state.preparation={emotion:'',focus:'',news:'',markets:'',rulesAccepted:false};
    state.analysis={biasDir:'',biasHTF:'',biasETF:'',biasNotes:'',liquidity:[],liquidityNotes:'',sweep:false,sweepNotes:'',mss:false,mssNotes:'',entryModel:'',direction:'',entry:'',sl:'',tp:'',ptval:state.settings.ptval||''};
    state.killSwitch=false; state.killReason=''; state.dailyStart={date:todayKey,balance:currentBalance()};
    state.workflowStage=state.activeTrade?'active':'prepare';
    saveState();
    if(state.activeTrade) toast('ACTIVE TRADE DETECTED — resolve it before starting a new session.','error');
  };

  // ----- Workflow navigation gate -----
  const oldNavigate=window.navigate;
  window.navigate=function(page){
    if(page==='setup' && !prepComplete()){toast('Complete Preparation and acknowledge the rules first.','error');page='prepare';}
    if(page==='check' && !analysisComplete()){toast('Complete the required market analysis first.','error');page=prepComplete()?'setup':'prepare';}
    if(page==='check' && state.activeTrade){toast('Resolve the active trade first.','error');page='today';}
    oldNavigate(page);
    renderV10();
  };

  // ----- Balance privacy -----
  function balanceIcon(hidden){return hidden?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.7A11.6 11.6 0 0 1 12 4.5c5.2 0 9 4.5 9 7.5a8.2 8.2 0 0 1-2.1 4.1M6.1 6.1C4.2 7.4 3 9.1 3 12c0 3 3.8 7.5 9 7.5 1.1 0 2.1-.2 3-.5"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';}
  window.toggleBalancePrivacy=function(){state.settings.hideBalance=!state.settings.hideBalance;saveState();renderAll();renderV10();};
  function fmtMoney(v){return state.settings.hideBalance?'••••••':formatCurrency(v,state.settings.currency);}
  function applyMoneyPrivacy(root=document){
    root.querySelectorAll('[data-money]').forEach(el=>{el.textContent=state.settings.hideBalance?'••••••':el.dataset.money;});
  }

  // ----- Start trade -----
  window.startTrade=function(){
    const v=validateTrade();
    if(!v.allowed){toast('TRADE BLOCKED: '+v.reasons[0],'error');renderV10();navigate('check');return;}
    const r=v.risk;
    state.activeTrade={
      id:'live-'+Date.now(),direction:state.analysis.direction,entry:state.analysis.entry,sl:state.analysis.sl,tp:state.analysis.tp,
      riskPct:r.riskPct,riskAmount:r.riskAmount,rr:r.rr,positionSize:r.positionSize,entryModel:state.analysis.entryModel,
      bias:state.analysis.biasDir,biasHTF:state.analysis.biasHTF,biasETF:state.analysis.biasETF,liquidity:[...(state.analysis.liquidity||[])],
      sweep:!!state.analysis.sweep,mss:!!state.analysis.mss,plannedAt:new Date().toISOString(),originalPlan:JSON.parse(JSON.stringify(state.analysis))
    };
    state.workflowStage='active';saveState();renderAll();renderV10();toast('TRADE APPROVED — FOLLOW THE PLAN.','success');
  };

  // ----- Mandatory post-trade review -----
  let pendingClose=null;
  window.openCloseTrade=function(result){
    if(!state.activeTrade)return;
    pendingClose=result;
    const r=calcRiskValues();
    const def=result==='WIN'?(r?r.rr:1):result==='LOSS'?-1:0;
    document.getElementById('close-trade-title').textContent='Close Trade — '+result;
    document.getElementById('close-trade-r').value=def;
    updateCloseTradePrev();openModal('modal-close-trade');
    document.getElementById('close-trade-r').oninput=updateCloseTradePrev;
  };
  window.confirmCloseTrade=function(){
    if(!state.activeTrade||!pendingClose)return;
    const r=num(document.getElementById('close-trade-r').value);if(!Number.isFinite(r)){toast('Enter a valid R value.','error');return;}
    closeModal('modal-close-trade');openPostReview(pendingClose,r);pendingClose=null;
  };
  function openPostReview(result,r){
    let m=document.getElementById('modal-v10-review');
    if(!m){m=document.createElement('div');m.id='modal-v10-review';m.className='modal-overlay';m.innerHTML='<div class="modal" style="max-width:620px"><div class="modal-title">POST-TRADE REVIEW</div><div class="modal-desc">The trade is not complete until the review is recorded.</div><div id="v10-review-fields" class="v10-review-grid"></div><div class="field mt16"><label>Notes</label><textarea id="v10-review-notes" placeholder="What happened? What did you learn?"></textarea></div><div class="btn-group mt16"><button class="btn btn-primary" id="v10-submit-review">Complete Review</button></div></div>';document.body.appendChild(m);}
    const qs=[['followedSetup','Did I follow my setup?'],['respectedRisk','Did I respect my risk?'],['plannedEntry','Did I enter according to plan?'],['movedStop','Did I move my stop?'],['chased','Did I chase?'],['revenge','Did I revenge trade?'],['overstayed','Did I overstay?'],['plannedExit','Did I exit according to plan?']];
    document.getElementById('v10-review-fields').innerHTML=qs.map(([k,l])=>'<div class="review-item"><span>'+l+'</span><span class="yn-group"><button class="yn-btn yes" data-k="'+k+'" data-v="yes">YES</button><button class="yn-btn no" data-k="'+k+'" data-v="no">NO</button></span></div>').join('');
    m.querySelectorAll('.yn-btn').forEach(b=>b.onclick=()=>{m.querySelectorAll('[data-k="'+b.dataset.k+'"]').forEach(x=>x.classList.remove('active'));b.classList.add('active');});
    m.querySelector('#v10-submit-review').onclick=()=>{
      const answers={};let missing=false;m.querySelectorAll('[data-k]').forEach(()=>{});
      qs.forEach(([k])=>{const a=m.querySelector('[data-k="'+k+'"][class*="active"]');if(!a)missing=true;else answers[k]=a.dataset.v==='yes';});
      if(missing){toast('Complete every YES/NO review item.','error');return;}
      const violations=[];if(answers.movedStop)violations.push('Moved stop');if(answers.chased)violations.push('Chased price');if(answers.revenge)violations.push('Revenge trade');if(answers.overstayed)violations.push('Overstayed');if(!answers.followedSetup)violations.push('Did not follow setup');if(!answers.respectedRisk)violations.push('Risk not respected');if(!answers.plannedEntry)violations.push('Entry deviated from plan');if(!answers.plannedExit)violations.push('Exit deviated from plan');
      const followed=Object.values(answers).filter(v=>v).length;const discipline=Math.round(followed/Object.keys(answers).length*100);
      finalizeTrade(result,r,answers,violations,discipline,document.getElementById('v10-review-notes').value||'');m.classList.remove('open');
    };
    m.classList.add('open');
  }
  function finalizeTrade(result,resultR,answers,violations,discipline,notes){
    const t=state.activeTrade, pl=resultR*t.riskAmount;
    const now=new Date();
    const trade={id:Date.now().toString(),date:state.currentDay,time:now.toLocaleTimeString('en-US',{hour12:false}),direction:t.direction,entry:t.entry,sl:t.sl,tp:t.tp,
      stopDistance:Math.abs(num(t.entry)-num(t.sl)),targetDistance:Math.abs(num(t.tp)-num(t.entry)),rr:Number(t.rr.toFixed(2)),riskPct:t.riskPct,riskAmount:t.riskAmount,positionSize:t.positionSize,
      setup:t.entryModel,entryModel:t.entryModel,session:state.settings.sessionName||'Configured Session',bias:t.bias,biasHTF:t.biasHTF,biasETF:t.biasETF,liquidity:t.liquidity,sweep:t.sweep,mss:t.mss,
      result,resultR:Number(resultR.toFixed(2)),resultPL:Number(pl.toFixed(2)),emotion:state.preparation.emotion,violation:violations.length?1:0,violations,discipline,reviewAnswers:answers,notes,plannedAt:t.plannedAt,closedAt:now.toISOString(),tradeType:'LIVE'};
    state.trades.push(trade);state.activeTrade=null;state.workflowStage='journal';state.lastTradeReview=trade;
    saveState();renderAll();renderV10();
    const stops=getStopReasons();if(stops.length)toast('TRADING TERMINATED: '+stops[0],'error');else toast('Trade recorded. Review complete.','success');
  }

  // ----- Enhanced risk renderer -----
  const oldRenderRiskCalc=window.renderRiskCalc;
  window.renderRiskCalc=function(){
    const el=document.getElementById('risk-calc-result');if(!el)return;const r=calcRiskValues(),s=state.settings;
    if(!r){el.innerHTML='<div class="text-muted text-xs">Enter valid Entry, SL, TP, Point Value and account/risk settings.</div>';return;}
    const direction=state.analysis.direction;const dirOk=r.slValid&&r.tpValid;const rrOk=r.rr>=num(s.minRR);
    el.innerHTML='<div class="calc-result">'+[
      ['Account Balance',fmtMoney(r.balance)],['Risk Amount',fmtMoney(r.riskAmount)],['Risk %',r.riskPct.toFixed(2)+'%'],['Entry',r.entry],['Stop Loss',r.sl],['Stop Distance',r.stopDist.toFixed(4)],['Take Profit',r.tp],['Target Distance',r.targetDist.toFixed(4)],['RR',r.rr.toFixed(2)+':1'],['Position Size',r.positionSize.toFixed(6)],['Potential Loss',fmtMoney(r.potentialLoss)],['Potential Profit','+'+fmtMoney(r.potentialProfit)]
    ].map(x=>'<div class="calc-row"><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join('')+'</div>'+
      '<div class="mt8">'+(!dirOk?'<div class="alert alert-red">✗ Directional price structure is invalid for '+direction+'.</div>':!rrOk?'<div class="alert alert-red">✗ RR '+r.rr.toFixed(2)+' is below minimum '+s.minRR+':1.</div>':'<div class="alert alert-green">✓ Risk calculation valid.</div>')+'</div>';
  };

  // ----- Analytics / journal tools -----
  function allTrades(){return Array.isArray(state.trades)?state.trades:[];}
  function analytics(trades=allTrades()){
    const n=trades.length,w=trades.filter(t=>t.result==='WIN').length,l=trades.filter(t=>t.result==='LOSS').length,be=trades.filter(t=>t.result==='BREAKEVEN').length;
    const rs=trades.map(t=>num(t.resultR)||0),wins=rs.filter(x=>x>0),losses=rs.filter(x=>x<0),pl=trades.reduce((a,t)=>a+(num(t.resultPL)||0),0);
    const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;const avgW=avg(wins),avgL=avg(losses),wr=n?w/n:0,lr=n?l/n:0;
    const expectancy=wr*avgW+lr*avgL;const grossW=trades.reduce((a,t)=>a+Math.max(0,num(t.resultPL)||0),0),grossL=Math.abs(trades.reduce((a,t)=>a+Math.min(0,num(t.resultPL)||0),0));
    let runW=0,runL=0,maxW=0,maxL=0,bal=0,peak=0,maxDD=0;[...trades].sort((a,b)=>Number(a.id)-Number(b.id)).forEach(t=>{if(t.result==='WIN'){runW++;runL=0}else if(t.result==='LOSS'){runL++;runW=0}else{runW=runL=0}maxW=Math.max(maxW,runW);maxL=Math.max(maxL,runL);bal+=num(t.resultPL)||0;peak=Math.max(peak,bal);maxDD=Math.max(maxDD,peak-bal);});
    const violations=trades.reduce((a,t)=>a+(t.violations?.length||t.violation?1:0),0),discipline=n?trades.reduce((a,t)=>a+(num(t.discipline)||0),0)/n:0;
    return {n,w,l,be,wr,lr,avgR:avg(rs),totalR:rs.reduce((a,b)=>a+b,0),avgW,avgL,expectancy,grossW,grossL,profitFactor:grossL?grossW/grossL:null,pl,maxW,maxL,maxDD,violations,discipline};
  }
  function stat(label,value,cls=''){return '<div class="v10-stat"><div class="label">'+label+'</div><div class="value '+cls+'">'+value+'</div></div>';}
  window.renderV10=function(){
    const hidden=!!state.settings.hideBalance;
    const toggle=document.getElementById('balance-privacy-toggle');
    if(toggle){toggle.innerHTML=balanceIcon(hidden);toggle.setAttribute('aria-label',hidden?'Show balance':'Hide balance');toggle.setAttribute('title',hidden?'Show balance':'Hide balance');toggle.setAttribute('aria-pressed',String(hidden));toggle.classList.toggle('is-hidden',hidden);}
    const today=document.getElementById('today-balance');
    if(today){today.textContent=hidden?'••••••':formatCurrency(state.settings.balance,state.settings.currency);today.classList.toggle('balance-hidden',hidden);}
    renderV10Analytics();renderV10TodayBanner();
  };
  function renderV10TodayBanner(){
    let host=document.getElementById('v10-flow-banner');if(!host){const todayPage=document.getElementById('page-today');if(!todayPage)return;host=document.createElement('div');host.id='v10-flow-banner';todayPage.insertBefore(host,todayPage.firstChild);}
    const v=validateTrade();const stage=state.activeTrade?'ACTIVE TRADE':state.workflowStage||'PREPARE';
    const steps=[['PREP','prepare',prepComplete()],['RULES','rules',!!state.preparation.rulesAccepted],['ANALYSIS','analysis',analysisComplete()],['RISK','risk',!!v.risk&&v.risk.slValid&&v.risk.tpValid&&v.risk.rr>=num(state.settings.minRR)],['CHECK','check',v.allowed&&!state.activeTrade],['RESULT','active',!!state.lastTradeReview]];
    host.innerHTML='<div class="card"><div class="flex-between"><div><div class="card-title mb0">XE3AGLE WORKFLOW</div><div class="text-xs text-muted">Current: '+stage+'</div></div><div class="v10-badge '+(v.allowed?'pill-green':'pill-amber')+'">'+(state.activeTrade?'ACTIVE TRADE':v.allowed?'TRADE READY':'PROCESS INCOMPLETE')+'</div></div><div class="v10-stepbar mt12">'+steps.map(x=>'<div class="v10-step '+(x[2]?'done ': '')+(stage.toUpperCase().includes(x[0])?'current':'')+'">'+x[0]+'</div>').join('')+'</div>'+(v.reasons.length?'<div class="alert alert-amber"><strong>NO TRADE YET</strong><br>'+v.reasons.slice(0,3).join('<br>')+(v.reasons.length>3?'<br>+ '+(v.reasons.length-3)+' more':'')+'</div>':'<div class="alert alert-green"><strong>ALL CONDITIONS PASSED — TRADE APPROVED</strong></div>')+'</div>';
  }
  function renderV10Analytics(){
    const el=document.getElementById('v10-analytics-content');if(!el)return;const a=analytics();
    const sign=x=>x>0?'+':'';const pct=x=>(x*100).toFixed(1)+'%';
    const rows=[['Total Trades',a.n],['Wins',a.w],['Losses',a.l],['Breakevens',a.be],['Win Rate',pct(a.wr)],['Average R',sign(a.avgR)+a.avgR.toFixed(2)],['Total R',sign(a.totalR)+a.totalR.toFixed(2)],['Expectancy',sign(a.expectancy)+a.expectancy.toFixed(2)+'R'],['Profit Factor',a.profitFactor==null?'—':a.profitFactor.toFixed(2)],['Total P/L',fmtMoney(a.pl)],['Max Consecutive Wins',a.maxW],['Max Consecutive Losses',a.maxL],['Max Drawdown',fmtMoney(-a.maxDD)],['Discipline Rate',a.discipline.toFixed(1)+'%'],['Rule Violations',a.violations]];
    const cal=calendarHTML();
    el.innerHTML='<div class="card"><div class="card-title">Performance</div><div class="v10-analytics-grid">'+rows.map(r=>stat(r[0],r[1],String(r[0]).includes('P/L')||String(r[0]).includes('R')?'':'')).join('')+'</div></div><div class="card"><div class="flex-between"><div><div class="card-title mb0">Trading Calendar</div><div class="text-xs text-muted">Click a day to inspect recorded trades.</div></div><div class="text-xs text-muted">'+state.currentDay+'</div></div><div class="mt12">'+cal+'</div></div><div class="card"><div class="card-title">Journal Tools</div><div class="btn-group"><button class="btn" onclick="exportCSV()">Export CSV</button><button class="btn" onclick="exportExcel()">Export Excel-compatible CSV</button><button class="btn" onclick="exportBackup()">Backup JSON</button></div></div>';
  }
  function calendarHTML(){
    const d=new Date(state.currentDay+'T12:00:00');const y=d.getFullYear(),m=d.getMonth();const first=new Date(y,m,1).getDay();const days=new Date(y,m+1,0).getDate();let h='<div class="v10-calendar">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<div class="v10-cal-head">'+x+'</div>').join('');for(let i=0;i<first;i++)h+='<div class="v10-cal-day muted"></div>';for(let day=1;day<=days;day++){const key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');const ts=allTrades().filter(t=>t.date===key),r=ts.reduce((a,t)=>a+(num(t.resultR)||0),0);h+='<div class="v10-cal-day" onclick="showDayDetail(\''+key+'\')"><div class="n">'+day+'</div><div class="r '+(r>0?'text-green':r<0?'text-red':'')+'">'+(ts.length?(r>0?'+':'')+r.toFixed(2)+'R':'—')+'</div><div class="text-xs text-muted">'+(ts.length?ts.length+' trade'+(ts.length>1?'s':''):'')+'</div></div>';}return h+'</div>';
  }

  // ----- CSV / Excel-compatible export -----
  function csvEscape(v){const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"';}
  window.exportCSV=function(){
    const fields=['date','time','tradeType','direction','entry','sl','tp','rr','riskPct','riskAmount','positionSize','setup','session','bias','result','resultR','resultPL','emotion','discipline','violation','violations','notes'];
    const lines=[fields.join(',')];allTrades().forEach(t=>lines.push(fields.map(f=>csvEscape(Array.isArray(t[f])?t[f].join('|'):t[f])).join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='xe3agle-trades.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV exported.','success');
  };
  window.exportExcel=function(){exportCSV();toast('Excel-compatible CSV exported.','info');};

  // ----- Settings enhancements -----
  function ensureSettings(){
    state.settings=state.settings||{};
    // Migrate old v8/v10 timing defaults to New York time once. Existing users who never changed the old UTC defaults get the correct NY session automatically.
    if(!state.settings.sessionTimezoneVersion){
      state.settings.timezone='America/New_York';
      if(!state.settings.sessionStart || state.settings.sessionStart==='13:00') state.settings.sessionStart='07:00';
      if(!state.settings.sessionEnd || state.settings.sessionEnd==='16:00') state.settings.sessionEnd='16:00';
      state.settings.sessionTimezoneVersion=2;
    }
    Object.assign(state.settings,{sessionStart:state.settings.sessionStart||'07:00',sessionEnd:state.settings.sessionEnd||'16:00',sessionRestriction:state.settings.sessionRestriction!==false,hideBalance:!!state.settings.hideBalance});
    if(!state.dailyStart)state.dailyStart={date:state.currentDay,balance:currentBalance()};
    if(!state.workflowStage)state.workflowStage=state.activeTrade?'active':(prepComplete()?'analysis':'prepare');
    if(!state.lastTradeReview)state.lastTradeReview=null;
  }

  // ----- Render status balance without breaking v8 -----
  const oldRenderStatusPage=window.renderStatusPage;
  window.renderStatusPage=function(){oldRenderStatusPage();
    const host=document.getElementById('status-content');if(!host)return;
    const bal='<div class="card"><div class="card-title">Account Integrity</div><div class="v10-analytics-grid">'+stat('Start Balance',fmtMoney(num(state.settings.balance)))+stat('Current Balance',fmtMoney(currentBalance()))+stat('Peak Balance',fmtMoney(peakBalance()))+stat('Day Start',fmtMoney(dailyStartBalance()))+stat('Daily P/L',fmtMoney(getDailyPL()))+stat('Max DD',fmtMoney(-analytics().maxDD))+'</div></div>';
    host.insertAdjacentHTML('afterbegin',bal);
  };

  // ----- Enhanced journal filters / export controls -----
  const oldRenderJournal=window.renderJournal;
  window.renderJournal=function(){oldRenderJournal();const wrap=document.getElementById('page-journal');if(wrap&&!wrap.querySelector('#v10-journal-tools')){const c=document.createElement('div');c.id='v10-journal-tools';c.className='card';c.innerHTML='<div class="flex-between"><div><div class="card-title mb0">Journal Tools</div><div class="text-xs text-muted">Live trades are automatically recorded after review.</div></div><div class="btn-group"><button class="btn btn-sm" onclick="exportCSV()">CSV</button><button class="btn btn-sm" onclick="exportExcel()">Excel</button><button class="btn btn-sm" onclick="navigate(\'analytics\')">Analytics / Calendar</button></div></div>';wrap.insertBefore(c,wrap.querySelector('#journal-table-wrap'));}};

  // Authentication/cloud UI is installed by js/app.js. Keep one authoritative auth layer.

  function renderAllV10(){ensureSettings();renderV10();applyMoneyPrivacy();}
  window.renderAllV10=renderAllV10;

  // Patch settings save to preserve v10 settings
  const oldSaveSettings=window.saveSettings;
  window.saveSettings=function(){oldSaveSettings();ensureSettings();saveState();renderAllV10();toast('Settings saved.','success');};

  // Initialize upgrade after v8 init has completed.
  ensureSettings();
  checkDayReset();
  renderAllV10();
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){oldRenderAll();renderAllV10();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){try{checkDayReset();renderV10();}catch(e){}}},{passive:true});
  window.addEventListener('focus',()=>{try{checkDayReset();renderV10();}catch(e){}},{passive:true});
})();
