import { applyAction } from './actions.js';
import { renewableTotal, oilPriceTerms, influencePool, influenceGain, compliance, variantEff } from './selectors.js';
import { ALLIED_PROGRAMS, TIERS, ACCESS_RULES, MEMBER_INCOME, LEAK } from '../data/alliance.js';
import { MONTHLY_SYSTEMS } from './systems.js';
import { assertInvariants } from './invariants.js';
import { NATIONS, DIP_TARGETS, INTEL_TARGETS, NATION_TRAITS } from '../data/nations.js';
import { REGIONS, REGION_BONUS, FLASHPOINTS } from '../data/regions.js';
import { PLATFORMS, BLACK_PROGRAMS, DV } from '../data/platforms.js';
import { SOCIAL_PROGRAMS, ISSUES, SECTOR_GAINS, SECTOR_DECAY } from '../data/economy.js';
import { COMP_RESPONSES, WORLD_EVENTS, DECISIONS } from '../data/world.js';
import { COVERT_PROGRAMS, INTEL_INFRA, INTEL_OPS, CRISIS_FRIENDLY, CRISIS_HOSTILE, CRISIS_STOLEN } from '../data/intel.js';
import { BLOC_TRADE } from '../data/trade.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { RES_META, CONCESSIONS } from '../data/energy.js';
import { sumDep, isAllyOf, topHostile, wSum, navalWeight, calcSCost, getEnergyTier, isDiversified, getRefineMult, triadLegs as legsOf, airMult, interceptChance, cnExposure } from './formulas.js';
import { naturalDrift } from './economy.js';
import { rng } from './rng.js';
import { stepIssues, ISSUE_TTL } from './issues.js';
import { pickWorldEvent, startWorldEvent, eventCooldowns, fireChain, eventEffects } from './events.js';

// ── v57 monthly tick, extracted (P2). Zero rule changes: test/parity-app.test.js proves the App's autosaves are
// byte-identical to v57 under a seeded stream. Phases run in v57 execution order; see reports/inventory-v57.md §5.
//   g  : the game state object (src/sim/state.js STATE_FIELDS). The App passes a live view over its refs.
//   S  : state-commit sink, v57 setter names (setStats, setSphere, ...). The App passes its React setters.
//   fx : { toast(msg), now() }. Presentation and clock stay outside src/sim.
// Reads of g see this month's in-flight values; S updates land after the month, exactly as React applied them in v57.
const STOP=Symbol('stop-month');

// economy: Equilibrium drift, talent, chokepoints and energy, IP, military target, sector budgets, tax, effects, dividends, force upkeep, exports, extraction; commits stats.
function economy(g,S,fx,m){
  const s=g.stats;const c=g.country;if(!s||!c)return STOP;
  // Dynamic equilibrium: sustained structural investment SHIFTS the nation's baseline.
  // Without this, mean-reversion drags inequality back to its starting value no matter the spend.
  const eqBase=g.equilibriumStats||s;
  const spCount=g.socialPrograms.size;
  const ba0=g.budgetAlloc;
  const eqAdj={...eqBase,
    inequality:Math.max(20,(eqBase.inequality||55)-spCount*2.5-(ba0.healthcare>110?(ba0.healthcare-100)/18:0)-(ba0.education>110?(ba0.education-100)/18:0)),
    healthcare:Math.min(95,(eqBase.healthcare||70)+(ba0.healthcare-100)*0.08+(g.socialPrograms.has('universal_healthcare')?6:0)),
    education:Math.min(95,(eqBase.education||70)+(ba0.education-100)*0.08+(g.socialPrograms.has('public_education')?5:0)),
    foodSecurity:Math.min(95,(eqBase.foodSecurity||75)+(g.socialPrograms.has('food_assistance')?6:0)),
    stability:(eqBase.stability||60)+spCount*1.2,
    unemployment:Math.max(2,(eqBase.unemployment||5)-(ba0.technology>110?(ba0.technology-100)/35:0)-((s.education||0)>80?1.2:0)-(g.socialPrograms.has('family_support')?0.5:0)-(spCount>=4?0.4:0)),
  };
  let ns=naturalDrift(s,g.interestRate,eqAdj);
  const led={};const cash=(k,v)=>{if(!v)return;ns.treasury+=v;led[k]=(led[k]||0)+v;};
  // ── TALENT ENGINE: education + growth + stability → retention → R&D speed + GDP ──
  const trait=NATION_TRAITS[g.country?.id]||{};
  g.tickCount++;
  const retentionTarget=Math.max(5,Math.min(100,
    (ns.education||60)*0.55 + (ns.stability||60)*0.25
    + (ns.gdpGrowth>2?14:ns.gdpGrowth>0.5?6:ns.gdpGrowth<-1?-12:0)
    - (ns.inequality>80?12:ns.inequality>70?5:0)
    - (trait.brainDrain||0)*22
  ));
  const retNow=g.talentRetention+(retentionTarget-g.talentRetention)*0.06;
  g.talentRetention=retNow;S.setTalentRetention(retNow);
  const rdSpeedMult=0.6+retNow/100*0.8;
  ns.gdpGrowth+=(retNow-60)/100*0.12;
  // ── CHOKEPOINTS: status = disrupted (event / blockade in governing region) | secured (your naval weight ≥2 there) | open
  const homeRid=Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(c.id))?.[0];
  const navalW=rid=>navalWeight(g.forceDeployments?.[rid]);
  const cs={};Object.entries(CHOKEPOINTS).forEach(([k,cp])=>{
    const disrupted=(g.worldEvent&&WORLD_EVENTS[g.worldEvent.id]?.choke===k)||!!g.blockades[cp.region];
    const escort=g.forcePosture[cp.region]==='escort'&&navalW(cp.region)>=2;
    cs[k]=disrupted?(escort?'escorted':'disrupted'):(navalW(cp.region)>=2?'secured':'open');});
  g.chokeStatus=cs;S.setChokeStatus(cs);
  const myRoutes=IMPORT_ROUTES[homeRid]||[];
  const fossilImports=['oil','gas','coal'].some(k=>g.importContracts.has(k));
  const pan=g.chokeDeals.panama||{};
  if(pan.locks>0){g.chokeDeals={...g.chokeDeals,panama:{...pan,locks:pan.locks-1}};if(pan.locks-1===0){fx.toast('🏗️ Panama third lane complete');}S.setChokeDeals({...g.chokeDeals});}
  if((pan.priority||pan.locks===0)&&cs.panama==='disrupted'&&g.worldEvent&&WORLD_EVENTS[g.worldEvent.id]?.choke==='panama')cs.panama='open'; // rationing/drought don't apply to you
  if(pan.locks===0&&(g.sphere.NA?.player||0)>60){cash('Canal transit fees',50);if((g.sphere.SA?.competitors?.china||0)>0)S.setSphere(p=>({...p,SA:{...p.SA,competitors:{...p.SA.competitors,china:Math.max(0,(p.SA.competitors?.china||0)-0.1)}}}));}
  const routeHit=fossilImports&&myRoutes.some(k=>cs[k]==='disrupted');
  const hormuzHit=cs.hormuz==='disrupted';
  if(g.sprRelease){if(g.spr>0){g.spr-=1;S.setSpr(g.spr);}else{g.sprRelease=false;S.setSprRelease(false);fx.toast('🛢️ Strategic reserve exhausted — release ends');}}
  const sprShield=g.sprRelease&&g.spr>=0;
  if(routeHit&&!sprShield){ns.inflation+=0.1;ns.gdpGrowth-=0.02;}
  if(hormuzHit&&(trait.energyDep||0)>0&&!sprShield){ns.inflation+=(trait.energyDep)*0.15;}
  if((trait.energyDep||0)>0){const eTier=getEnergyTier(g.resources,g.resExtraction,g.importContracts);const cushioned=eTier==='nuclear'||eTier==='high';if(!cushioned){ns.inflation+=(trait.energyDep)*0.12;ns.gdpGrowth-=(trait.energyDep)*0.03;}}
  if((trait.resourceCurse||0)>0){const cycle=Math.sin(g.tickCount/40)*(trait.resourceCurse);cash('Commodity cycle',Math.round(cycle*120));ns.gdpGrowth+=cycle*0.05;}
  if(trait.svFund)cash('Sovereign fund',60);
  if(trait.leaseTalent&&g.expertiseLease>0){cash('Expertise leasing',g.expertiseLease*45);ns.gdpGrowth+=g.expertiseLease*0.02;g.talentRetention=Math.max(5,g.talentRetention-g.expertiseLease*0.6);}
  // ── IP PORTFOLIO: R&D accumulates intellectual property; policy turns it into money or moat ──
  const totalRD=Object.values(g.defLevels).reduce((a,b)=>a+(b||0),0);
  // Tech LEVERAGE: IP is worth more the further ahead of rivals you are (scarcity of frontier tech)
  const rivalAvgRD=Object.values(g.globalDef).reduce((a,l)=>a+Object.values(l).reduce((x,y)=>x+(y||0),0),0)/Math.max(1,Object.keys(g.globalDef).length);
  const techLead=Math.max(0.7,Math.min(2.2,1+(totalRD-rivalAvgRD)/40));
  const ipGrow=totalRD*0.04+(g.blackResearch?0.3:0); // research depth compounds IP value
  g.ipPortfolio=Math.min(1000,g.ipPortfolio+ipGrow);
  if(g.ipPolicy==='license'){cash('IP royalties',Math.round(g.ipPortfolio*0.6*techLead));ns.gdpGrowth+=0.02;} // royalties scale with your tech lead
  else if(g.ipPolicy==='balanced'){cash('IP royalties',Math.round(g.ipPortfolio*0.3*techLead));}
  S.setIpPortfolio(g.ipPortfolio);
  // ── CROSS-TAB CONSEQUENCES: investments in one domain ripple into others ──
  // Stability → capital flows: stable nations attract investment; unstable ones bleed confidence
  if(ns.stability>75)cash('Stability FDI',Math.round((ns.stability-75)*4));
  else if(ns.stability<40){ns.gdpGrowth-=0.03;} // capital flight drag (relations growth penalty handled in influence block via stability check)
  // Energy independence → manufacturing competitiveness: cheap power = export edge + lower inflation
  const eTierX=getEnergyTier(g.resources,g.resExtraction,g.importContracts);
  if(eTierX==='nuclear'||eTierX==='high'){cash('Energy edge',45);ns.inflation-=0.04;ns.gdpGrowth+=0.015;}
  // Alliances → access: defense-pact allies lower your import costs and buy more from you
  const pactCount=g.defensePacts.size;
  if(pactCount>0&&g.importContracts.size>0)cash('Ally supply savings',pactCount*g.importContracts.size*8); // allied supply discounts ≈ savings
  // Obsolescence effectiveness (hoisted: military target below depends on these;
  // declaring after use froze the clock via TDZ ReferenceError in v13)
  const newAge={defense:(g.sectorAge.defense||0)+1,energy:(g.sectorAge.energy||0)+1};
  const defEffM=newAge.defense>480?Math.max(0.7,1-(newAge.defense-480)*0.0008):1;
  const enEff =newAge.energy >480?Math.max(0.7,1-(newAge.energy -480)*0.0008):1;
  // Defense tech bonus to military — advanced equipment prevents decay
  const totalDL=Object.values(g.defLevels).reduce((sum,v)=>sum+(v||0),0);
  // Black program R&D progress (a SAP runs over many months like vertical research)
  if(g.blackResearch){
    const br=g.blackResearch;const nprog=br.prog+1;
    if(nprog>=br.mo){
      g.blackPrograms={...g.blackPrograms,[br.id]:1};S.setBlackPrograms({...g.blackPrograms});
      g.blackResearch=null;S.setBlackResearch(null);
      fx.toast(`🛩️ ${BLACK_PROGRAMS[br.id].n} achieved operational capability — classified`);
      S.setLog(p=>[{msg:`🛩️ Black program complete: ${BLACK_PROGRAMS[br.id].n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
    } else {g.blackResearch={...br,prog:nprog};S.setBlackResearch({...br,prog:nprog});}
  }
  // E3 (#15): prototype lines (catalog programs that start at prototype) run in parallel, outside the single SAP slot.
  // A program with `risk` may slip 12 months once at first flight; funding its parallel program halves the risk.
  if(Object.keys(g.arsenal?.dev||{}).length){
    const dev=g.arsenal.dev;const nd={...dev};let done=null;
    for(const id of Object.keys(dev)){
      const d=dev[id];const bp=BLACK_PROGRAMS[id];const np=d.prog+1;
      if(np<d.mo){nd[id]={...d,prog:np};continue;}
      const both=bp.parallel&&(dev[bp.parallel]||(+g.blackPrograms?.[bp.parallel]||0)>0);
      const risk=bp.risk&&!d.slipped?(both?bp.risk/2:bp.risk):0;
      if(risk&&rng()<risk){nd[id]={...d,prog:Math.max(0,d.mo-12),slipped:true};fx.toast(`⚠ ${bp.n} prototype slipped 12 months`);S.setLog(p=>[{msg:`⚠ ${bp.n} slips 12mo`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);continue;}
      delete nd[id];done={...(done||g.blackPrograms),[id]:1};
      fx.toast(`🛩️ ${bp.n} enters low-rate production — first article delivered`);
      S.setLog(p=>[{msg:`🛩️ ${bp.n}: LRIP`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
    }
    if(done){g.blackPrograms=done;S.setBlackPrograms({...done});}
    g.arsenal={...g.arsenal,dev:nd};S.setArsenal(g.arsenal);
  }
  const milMult=g.doctrine==='vanguard'?0.8:1;
  // Military power DERIVES from deployed platforms; research alone caps at ~65
  const domMil=Object.entries(g.platforms||{}).reduce((sum,[pid,ct])=>{
    const p=PLATFORMS[pid];if(!p||!ct)return sum;
    const over=Object.entries(p.req).reduce((o,[v,rq])=>o+Math.max(0,(g.defLevels[v]||0)-rq),0);
    return sum+ct*p.mil*Math.min(2,1+0.07*over);
  },0);
  const impMil=Object.entries(g.platformsImported||{}).reduce((s2,[pid2,ct2])=>{const p2=PLATFORMS[pid2];return s2+(p2&&ct2?ct2*p2.mil*0.9:0);},0);
  const platMil=(domMil+impMil)*((g.personnelPay||100)<90?0.85:(g.personnelPay||100)>=120?1.1:1)*(g.procureMode==='surge'?1.08:g.procureMode==='efficiency'?0.95:1);
  // E7 (#19): allied program access. As a member: compliance check (breach suspends), suspension clock, workshare, deliveries.
  // As the owner: export income per member and a leak roll per member (rng only while members exist).
  const acc0=g.arsenal?.access||{};
  if(Object.keys(acc0).length||(g.arsenal?.orders||[]).length){
    const me=c.id;const acc={...acc0};const comp=compliance(g);let relD={};
    for(const [pid,row0] of Object.entries(acc0)){
      const A=ALLIED_PROGRAMS[pid];const bp=BLACK_PROGRAMS[pid];const a=row0[me];
      if(a&&A.owner!==me){
        if(a.status==='active'&&!comp.ok){
          acc[pid]={...row0,[me]:{...a,status:'suspended',susp:ACCESS_RULES.suspendMo}};relD[A.owner]=(relD[A.owner]||0)-ACCESS_RULES.breachRel;
          const why=!comp.ciOk?'counter-intel below the floor':!comp.expOk?'espionage exposure above the ceiling':`flagged deal with ${comp.flagged.join(', ')}`;
          fx.toast(`🚫 ${bp.n} access suspended — ${why}`);S.setLog(p=>[{msg:`🚫 ${bp.n} suspended: ${why}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
        } else if(a.status==='suspended'&&a.susp>0)acc[pid]={...row0,[me]:{...a,susp:a.susp-1}};
        else if(a.status==='active'&&!a.founder&&TIERS[a.tier].work>0){cash('Program workshare',Math.round(bp.cost*TIERS[a.tier].work));ns.unemployment=Math.max(0,ns.unemployment-0.01);}
      }
      if(A.owner===me)for(const [nid,m] of Object.entries(row0)){
        if(nid===me)continue;cash('Allied program exports',MEMBER_INCOME[m.tier]);
        if(rng()<LEAK.base+(NATIONS[nid]?.secFlag?LEAK.flagged:0)){
          const atk=ACCESS_RULES.flagged[Math.floor(rng()*ACCESS_RULES.flagged.length)];const kv=bp.kv||Object.keys(bp.req)[0];
          S.setGlobalDef(p=>{const ng={...p};if(ng[atk])ng[atk]={...ng[atk],[kv]:Math.min(5,(ng[atk][kv]||0)+0.3)};return ng;});
          fx.toast(`🚨 ${bp.n} leak via ${NATIONS[nid].n} — ${atk.charAt(0).toUpperCase()+atk.slice(1)} gains ${kv}`);
        }
      }
    }
    const orders=g.arsenal.orders||[];const next=[];let got=null;
    for(const o of orders){
      if(acc[o.id]?.[me]?.status!=='active'){next.push(o);continue;}
      if(o.mo>1){next.push({...o,mo:o.mo-1});continue;}
      got={...(got||g.blackPrograms),[o.id]:(+(got||g.blackPrograms)?.[o.id]||0)+1};fx.toast(`📦 ${BLACK_PROGRAMS[o.id].n} delivered (${TIERS[acc[o.id][me].tier].n} variant)`);
    }
    if(got){g.blackPrograms=got;S.setBlackPrograms({...got});}
    if(Object.keys(relD).length){const nr={...g.nationRelations};for(const [n,d] of Object.entries(relD))nr[n]=Math.max(-100,(nr[n]||0)+d);g.nationRelations=nr;S.setNationRelations(nr);}
    g.arsenal={...g.arsenal,access:acc,orders:next};S.setArsenal(g.arsenal);
  }
  // Allied variants fly at their tier's performance (E7); own programs at 1, so v57 sums are unchanged.
  const blackMil=Object.keys(g.blackPrograms||{}).reduce((s2,bid)=>s2+(BLACK_PROGRAMS[bid]?.mil||0)*variantEff(g,bid),0);
  const ccaMult=airMult(g.blackPrograms); // drone wings force-multiply air
  const milTarget=Math.min(100,30+(platMil*ccaMult+blackMil)*milMult*defEffM+totalDL*0.5+(g.doctrine==='fortress'?6:0));
  ns.military=ns.military+(milTarget-ns.military)*0.05;

  // ── Sector Fiscal Engine ─────────────────────────────────────────────────
  const ba=g.budgetAlloc;
  let totalSectorSpend=0;
  Object.entries(ba).forEach(([sector,alloc])=>{
    const cost=calcSCost(sector,alloc,g.sectorMaturity);
    cash('Sector budgets',-cost);totalSectorSpend+=cost;
    if(alloc>100){
      const over=(alloc-100)/100;
      Object.entries(SECTOR_GAINS[sector]||{}).forEach(([k,v])=>{if(k in ns)ns[k]+=v*over;});
    } else if(alloc<100){
      const under=(100-alloc)/100;
      Object.entries(SECTOR_DECAY[sector]||{}).forEach(([k,v])=>{if(k in ns)ns[k]-=v*under;});
    }
  });
  // Social friction: defense+intel vs healthcare+education
  const defSpend=calcSCost('defense',ba.defense,g.sectorMaturity)+(g.intelBudget||1)*200/12;
  const socialSpend=calcSCost('healthcare',ba.healthcare,g.sectorMaturity)+calcSCost('education',ba.education,g.sectorMaturity);
  if(defSpend>socialSpend*(g.doctrine==='fortress'?3:2))ns.stability-=0.07;
  // Guns vs butter: sustained heavy defense burden drags civilian growth unless the economy is strong
  if(defSpend>socialSpend*2.5&&ns.gdpGrowth<3)ns.gdpGrowth-=0.04;
  // ── Surplus Automation → debt buydown ────────────────────────────────────
  const estRevenue=Math.max(0,ns.gdpGrowth*40)+180+Object.entries(g.defExports).reduce((s,[k,d])=>{const bid=k.split('_')[0];const dom=g.dominance.regions?.has(NATIONS[bid]?.region)?1.18:1;const att=g.embassies.has(bid)?1.10:1;const euB=(g.blocTrade.eu>=2&&BLOC_TRADE.eu.members.includes(bid))?1.15:1;return s+(d.revenue||0)/12*dom*att*euB;},0);
  const surplus=estRevenue-totalSectorSpend;
  if(ns.treasury>4500&&surplus>0){
    ns.debtGdp=Math.max(0,ns.debtGdp-Math.min(0.12,surplus*0.8/900));// $600M buys down 1pt debt/GDP
  }
  // ── 40-Year Obsolescence ─────────────────────────────────────────────────
  // (newAge/defEffM/enEff hoisted to top of tick — used by military target above)
  if(defEffM<1)ns.stability-=Math.min(0.04,(1-defEffM)*0.1);
  if(enEff<1) ns.inflation+=Math.min(0.08,(1-enEff)*0.2);
  S.setSectorAge(newAge);g.sectorAge=newAge;
  // Policy levers
  // ── TAX ENGINE: revenue = GDP base × rate × breadth(talent+education) ──
  // Talent retention and education widen the tax base — human-capital investment funds the state.
  const taxRate=(+g.taxPolicy||28)/100;
  const gdpBase=1600+(s.education||60)*7+Math.max(0,(s.gdpGrowth||0))*90; // notional taxable economy
  const breadth=0.6+(g.talentRetention/100)*0.5+(s.education>75?0.15:0); // retention & education broaden the base
  const taxRevenue=Math.round(gdpBase*taxRate*breadth);
  cash('Taxes',taxRevenue);
  // Tradeoffs: high rates fund the state but slow growth and push talent out; low rates do the reverse
  const rateDev=taxRate-0.28; // deviation from neutral 28%
  ns.gdpGrowth-=rateDev*0.55;            // +rate → -growth
  ns.inequality-=rateDev*0.5*100*0.01;   // +rate → progressive, lowers inequality (~ -0.5/10pts)
  if(taxRate>0.36)g.talentRetention=Math.max(5,g.talentRetention-(taxRate-0.36)*8); // very high tax accelerates brain drain
  if(taxRate<0.18)g.talentRetention=Math.min(100,g.talentRetention+(0.18-taxRate)*4); // low tax retains talent
  if(g.spendingMode==='austerity'){ns.debtGdp-=0.12;ns.stability-=0.05;ns.healthcare-=0.04;}
  else if(g.spendingMode==='stimulus'){ns.gdpGrowth+=0.05;ns.debtGdp+=0.12;ns.stability+=0.03;}

  // Active effects (tech/trade/health investments)
  const newAE=[];
  const doc=g.doctrine;
  g.activeEffects.forEach(e=>{
    if(e.monthsLeft>0&&e.stat in ns){
      let d=e.d;
      if(doc==='hegemon'&&e.source?.startsWith('tr'))d*=1.25;
      if(doc==='vanguard'&&e.source?.startsWith('t')&&!e.source?.startsWith('tr'))d*=1.4;
      if(d>0&&['stability','healthcare','education','foodSecurity','military'].includes(e.stat))d*=Math.max(0.15,1-(ns[e.stat]||0)/115);
      ns[e.stat]+=d;newAE.push({...e,monthsLeft:e.monthsLeft-1});
    }
  });
  S.setActiveEffects(newAE.filter(e=>e.monthsLeft>0));

  // Deployments (policy briefs)
  g.deployments.forEach(d=>{if(d.status!=='active')return;const f=1/d.timeMonths;(d.effects||[]).forEach(e=>{ns[e.s]=(ns[e.s]||0)+e.d*f;});});
  S.setDeployments(p=>p.map(d=>{if(d.status!=='active')return d;const ne=d.monthsElapsed+1;if(ne>=d.timeMonths){S.setLog(l=>[{msg:`✅ ${d.policyName}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);return{...d,monthsElapsed:ne,status:'complete'};}return{...d,monthsElapsed:ne};}));

  // Petrodollar dominance (US only)
  if(g.activePolicies.has('petrodollar')&&c.id==='usa'){
    ns.inflation=Math.max(0,ns.inflation-0.25);
    ns.gdpGrowth+=0.08;
    cash('Base operations',400);
    ns.debtGdp=Math.max(0,ns.debtGdp-0.1);
  }

  // Region dividends — dominated regions (>60% sphere) pay monthly AND leverage other systems
  const divMult=doc==='hegemon'?1.5:1;
  let domCount=0;const domRegions=new Set();
  Object.entries(g.sphere).forEach(([rid,sph])=>{
    if((sph.player||0)>60){
      domCount++;domRegions.add(rid);
      const b=REGION_BONUS[rid];if(!b)return;
      Object.entries(b).forEach(([k,v])=>{if(k in ns)ns[k]+=v*divMult;});
    }
  });
  g.dominance={count:domCount,regions:domRegions};
  // LEVERAGE: map dominance multiplies trade, cuts import costs, and projects influence.
  // Each dominated region = trade flows through your sphere + resource access + diplomatic reach.
  const domTradeMult=1+domCount*0.12;   // export revenue leverage (applied in sellDefTech)
  const domImportCut=Math.max(0.55,1-domCount*0.07); // controlled regions supply you cheaper
  g.dominanceLeverage={trade:domTradeMult,importCut:domImportCut};
  if(domCount>0){
    // Trade-lane income scales with how much of the map your sphere covers
    cash('Trade lanes',domCount*18);
  }
  // Doctrine passives
  if(doc==='shadow')ns.stability=Math.max(0,ns.stability-0.015);
  // Force structure maintenance
  // Force projection: blue-water and air power extends influence into contested regions
  const projUnits=(g.platforms.carrier_group||0)*2+(g.platforms.sub_fleet||0)+(g.platforms.fighter_wing||0)*0.5+(g.platforms.drone_swarm||0)+(g.platforms.hypersonic_bty||0)+((g.platformsImported.carrier_group||0)*2+(g.platformsImported.sub_fleet||0)+(g.platformsImported.fighter_wing||0)*0.5+(g.platformsImported.drone_swarm||0))*0.9;
  const fdTot=Object.values(g.forceDeployments||{}).reduce((a,b)=>a+sumDep(b),0);
  // Military LEVERAGE: a strong military backing forces deployed in regions you dominate
  // lets you extract security guarantees — protection income from aligned nations there.
  if(fdTot>0&&(ns.military||0)>=55&&g.dominance.count>0){
    const tribute=Math.min(g.dominance.count,fdTot)*Math.round((ns.military/100)*22);
    cash('Security tribute',tribute);
  }
  if((projUnits>0||fdTot>0)&&g.gracePeriod<=0){
    const projRate=Math.min(0.6,projUnits*0.05);
    const sphP={...g.sphere};let projHit=false;
    Object.entries(sphP).forEach(([rid,sph])=>{
      const pv=sph.player||0;let gain=0;
      if(projRate>0&&pv>25&&pv<60)gain+=projRate;
      const dep=sumDep(g.forceDeployments?.[rid]);
      const wdep=wSum(g.forceDeployments?.[rid],g.blackPrograms);
      if((g.forceDeployments?.[rid]?.sr72||0)>0&&pv<95)gain+=0.04; // SR-72 on station: persistent regional reconnaissance
      const post=g.forcePosture[rid]||'deter';
      const perUnit=post==='deter'?0.12:post==='humanitarian'?((g.flashpoint?.rid===rid||(g.worldEvent&&WORLD_EVENTS[g.worldEvent.id]?.choke&&CHOKEPOINTS[WORLD_EVENTS[g.worldEvent.id].choke]?.region===rid))?0.2:0.04):0.06;
      if(dep>0&&pv<95)gain+=Math.min(0.6,dep*perUnit);
      if(post==='humanitarian'&&dep>0){cash('Humanitarian ops',-dep*30);const relH={...g.nationRelations};let hCh=false;DIP_TARGETS.forEach(t=>{if(t.region===rid){relH[t.id]=Math.min(100,(relH[t.id]||0)+1);hCh=true;}});if(hCh){g.nationRelations=relH;S.setNationRelations(relH);}}
      if(post==='exercise'&&dep>0){const relX={...g.nationRelations};let xCh=false;DIP_TARGETS.forEach(t=>{if(t.region===rid&&(isAllyOf(c.id,t.id)||g.defensePacts.has(t.id)||(relX[t.id]||0)>=60)){relX[t.id]=Math.min(100,(relX[t.id]||0)+0.5);xCh=true;}});if(xCh){g.nationRelations=relX;S.setNationRelations(relX);}}
      if(post==='escort'&&dep>0){const top=topHostile(sph.competitors,c.id);if(top&&g.tickCount%2===0)S.setRivalTension(p=>({...p,[top[0]]:Math.min(99,(p[top[0]]||0)+1)}));}
      // Deployed forces actively suppress the leading rival — influence is contested, not parallel
      let comps=sph.competitors;
      const suppM=post==='deter'?1:post==='isr'?0.5:0; // escort/exercise/humanitarian forces aren't pushing
      if(dep>0&&suppM>0){const top=topHostile(comps,c.id);if(top&&top[1]>5){comps={...comps,[top[0]]:Math.max(0,top[1]-Math.min(0.5,wdep*0.08*suppM))};}}
      // Coalition: allied bloc presence alongside your forces is reinforcement, not rivalry
      {const allied=Object.entries(comps||{}).filter(([cid,v])=>isAllyOf(c.id,cid)&&v>=25).length;if(allied>0&&dep>0&&pv<95)gain+=0.03*allied*(post==='exercise'?2:1);}
      if(gain>0||comps!==sph.competitors){sphP[rid]={...sph,player:Math.min(100,pv+gain),competitors:comps};projHit=true;}
    });
    if(projHit)S.setSphere(sphP);
    cash('Forward basing',-fdTot*4);
  }
  // Naval platforms secure trade lanes — direct treasury utility
  cash('Power projection',Math.round((((g.platforms.carrier_group||0)+(g.platforms.sub_fleet||0)+((g.platformsImported.carrier_group||0)+(g.platformsImported.sub_fleet||0))*0.9)*10)));
  const unitTotal=Object.values(g.platforms||{}).reduce((a,b)=>a+(b||0),0)+Object.values(g.platformsImported||{}).reduce((a,b)=>a+(b||0),0);
  const maintM=g.procureMode==='efficiency'?0.85:g.procureMode==='surge'?1.2:1;
  {let pM=0;Object.entries(g.platforms||{}).forEach(([pid,ct])=>{const p=PLATFORMS[pid];if(p&&ct)pM+=p.maint*ct*maintM;});
  Object.entries(g.platformsImported||{}).forEach(([pid,ct])=>{const p=PLATFORMS[pid];if(p&&ct)pM+=p.maint*ct*maintM*1.25;});cash('Force maintenance',-Math.round(pM));} // foreign parts premium
  const triadLegs=legsOf(g.platforms,g.blackPrograms);
  if(triadLegs>=3)ns.stability+=0.08; // full triad/strategic deterrent security umbrella
  cash('Personnel',-Math.round(unitTotal*3*((g.personnelPay||100)/100)));
  if(unitTotal>0){if((g.personnelPay||100)<90)ns.stability-=0.03;else if((g.personnelPay||100)>=120)ns.stability+=0.02;}
  // Social programs: monthly cost + QoL effects
  {let sC=0;g.socialPrograms.forEach(spId=>{const sp=SOCIAL_PROGRAMS[spId];if(!sp)return;sC+=sp.cost;Object.entries(sp.fx).forEach(([k,v])=>{if(k in ns)ns[k]+=v;});});cash('Social programs',-sC);}
  // Quality of Life composite drives stability + growth
  const qol=(ns.healthcare+ns.education+ns.foodSecurity+(100-ns.inequality))/4;
  if(qol>75){ns.stability+=0.04;ns.gdpGrowth+=0.015;}else if(qol<45){ns.stability-=0.05;}
  // Defense export revenue
  Object.entries(g.defExports).forEach(([k,deal])=>{const bid=k.split('_')[0];const brg=NATIONS[bid]?.region;if(brg&&g.blockades[brg])return; // sea lanes interdicted
    const euB=(g.blocTrade.eu>=2&&BLOC_TRADE.eu.members.includes(bid))?1.15:1;
    const laneHit=Object.entries(CHOKEPOINTS).some(([k,cp])=>cs[k]==='disrupted'&&cp.downstream.includes(brg))?0.75:1;
    if(g.pariah>0)return; // contracts frozen
    if(g.embargoes.has(bid))return; // they won't pay a supplier that cut their lights
    if((deal.relationship||0)>20)cash('Arms exports',Math.round(deal.revenue/12*euB*laneHit));});

  // Resource extraction
  const newRes={...g.resources};
  const oilNations=['usa','russia','norway'];
  const refMult=oilNations.includes(c.id)?getRefineMult(g.defLevels):1.0;
  // Renewable energy: material returns — avoided imports, green industry, health, exports
  const renTot=renewableTotal(g);
  if(renTot>0){
    cash('Energy edge',renTot*6);                                   // avoided fuel imports: up to $90M/mo at 15
    ns.gdpGrowth+=renTot*0.004;                              // green industrial base: up to +0.06
    if(renTot>=8)ns.healthcare=Math.min(100,ns.healthcare+0.02); // air quality dividend
    if(renTot>=12)cash('Energy edge',40);                           // grid surplus exported to neighbors
  }
  const oilExportM=oilPriceTerms(g,{renTot,hormuzHit}).mult; // terms shared with the HUD why-breakdown (selectors.js)
  // Resource import contracts: continuity when domestic reserves run dry
  if(g.importContracts.size>0){
    const blocCut=(g.blocTrade.eu>=1?0.9:1)*(g.blocTrade.cn>=1?0.85:1);
    const secured=myRoutes.length&&myRoutes.every(k=>cs[k]==='secured'||cs[k]==='escorted');
    let impCost=g.importContracts.size*80*(g.dominanceLeverage.importCut||1)*blocCut*(routeHit&&!sprShield?1.5:1)*(secured?0.9:1)*(g.embargoedBy&&!isDiversified(g)&&!sprShield?1.3:1);
    if(Object.keys(g.stewardship).length&&g.importContracts.has('oil'))impCost-=40; // you market their crude
    if((g.chokeDeals.panama||{}).priority&&myRoutes.includes('panama'))impCost*=0.85;
    if(g.blocTrade.opec>=1){let foss=0;['oil','gas','coal'].forEach(k=>{if(g.importContracts.has(k))foss++;});impCost-=foss*16;}
    cash('Imports',-Math.round(Math.max(0,impCost)));ns.inflation+=g.importContracts.size*0.03;}
  // Energy shortage: no domestic fossils left, weak renewables, no import lifeline
  const fossilLeft=['oil','gas','coal'].some(k=>(g.resources?.[k]?.r||0)>1);
  const impFossil=['oil','gas','coal'].some(k=>g.importContracts.has(k));
  if(!fossilLeft&&renTot<6&&!impFossil&&g.gracePeriod<=0){ns.inflation+=0.12;ns.gdpGrowth-=0.04;ns.stability-=0.05;}
  Object.entries(g.resExtraction).forEach(([k,rate])=>{
    if(!newRes[k]||newRes[k].r<=0||!rate)return;
    const meta=RES_META[k];if(!meta)return;
    const actual=Math.min(rate,newRes[k].r);
    const isOil=['oil','gas'].includes(k);
    const shr=isOil?(g.exportShare[k]??0.6):1;
    cash('Extraction',Math.round(actual*meta.rev*(isOil?refMult*oilExportM*(0.45+0.55*shr):1)));
    if(isOil&&actual>0){ns.inflation-=0.03*(1-shr)*Math.min(1,actual/2);if((trait.energyDep||0)>0)ns.gdpGrowth+=0.01*(1-shr);}
    newRes[k]={...newRes[k],r:Math.max(0,newRes[k].r-actual*meta.depRate)};
  });
  // GGRB extraction
  if(g.grrbState.unlocked&&(g.resExtraction.shaleOil||0)>0&&newRes.shaleOil){
    const ms=g.defLevels.materials||0;const grrbRate=g.resExtraction.shaleOil||0;
    const grrbMult=ms>=4?refMult*1.4:refMult*0.7;
    // Phase II: nuclear process heat unlocks the deep heavy-crude tranche — in-situ retorting
    const p2=g.grrbState.phase2?2.5:1;
    const envM=g.grrbState.phase2?0.4:1;
    const actual=Math.min(grrbRate,newRes.shaleOil.r);
    cash('Extraction',Math.round(actual*12*grrbMult*p2*oilExportM));
    newRes.shaleOil={...newRes.shaleOil,r:Math.max(0,newRes.shaleOil.r-actual*0.005)};
    const msL=g.defLevels.materials||0;
    ns.inequality+=Math.max(0.02,(0.2-(msL-3)*0.04)*envM);ns.stability-=Math.max(0.01,(0.1-(msL-3)*0.02)*envM);
  }
  S.setResources(newRes);

  // GGRB survey countdown
  if(g.grrbState.surveying&&g.grrbState.surveyMo>0){
    const newMo=g.grrbState.surveyMo-1;
    if(newMo<=0){
      const nl={...g.grrbState,surveying:false,surveyMo:0,unlocked:true};
      S.setGrrbState(nl);g.grrbState=nl;
      const grrbRes={...g.resources,shaleOil:{r:3000,max:3000}};
      S.setResources(grrbRes);g.resources=grrbRes;
      S.setLog(l=>[{msg:'🏔️ Greater Green River Basin unlocked — 3,000 units shale oil available',yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
      fx.toast('🏔️ GGRB unlocked! Shale extraction now available in Resources.');
    } else {
      const nl={...g.grrbState,surveyMo:newMo};
      S.setGrrbState(nl);g.grrbState=nl;
    }
  }

  // Clamp all stats
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  ns.stability=cl(ns.stability,0,100);ns.healthcare=cl(ns.healthcare,0,100);
  ns.education=cl(ns.education,0,100);ns.foodSecurity=cl(ns.foodSecurity,0,100);
  ns.inequality=cl(ns.inequality,0,100);ns.military=cl(ns.military,0,100);
  ns.unemployment=cl(ns.unemployment,0,45);ns.inflation=cl(ns.inflation,-2,80);
  ns.gdpGrowth=cl(ns.gdpGrowth,-12,25);ns.debtGdp=cl(ns.debtGdp,0,400);
  S.setLedger(led);
  S.setStatsTrend({treasury:ns.treasury-s.treasury,gdpGrowth:ns.gdpGrowth-s.gdpGrowth,unemployment:ns.unemployment-s.unemployment,inflation:ns.inflation-s.inflation,stability:ns.stability-s.stability,military:ns.military-s.military});
  S.setStats(ns);
  m.c=c;m.ns=ns;m.led=led;m.cash=cash;m.trait=trait;m.rdSpeedMult=rdSpeedMult;m.navalW=navalW;m.sprShield=sprShield;
}

// military: R&D completion and spillovers, rival R&D growth, tension bookkeeping and self-purge, concessions, embargoes, stewardship, platform development, pariah clock, brink, blockades.
function research(g,S,fx,m){
  const {c,ns,cash,trait,rdSpeedMult,navalW,sprShield}=m;
  // Defense research
  const ndr={...g.defResearch};const newSpill=new Set(g.spillApplied);let dvChanged=false;
  Object.entries(ndr).forEach(([vert,ml])=>{
    const ml2=ml-rdSpeedMult;
    if(ml2<=1){
      delete ndr[vert];
      const newLvl=(g.defLevels[vert]||0)+1;
      S.setDefLevels(p=>({...p,[vert]:newLvl}));dvChanged=true;
      S.setSectorMaturity(p=>({...p,defense:0}));g.sectorMaturity={...g.sectorMaturity,defense:0};
      const lvlDef=DV[vert]?.lvl[newLvl-1];
      const spillKey=`${vert}_${newLvl}`;
      if(lvlDef&&!g.spillApplied.has(spillKey)&&lvlDef.sp){
        newSpill.add(spillKey);
        S.setStats(p=>{const ns2={...p};Object.entries(lvlDef.sp||{}).forEach(([k,v])=>{if(k in ns2)ns2[k]+=v*0.5*( ['stability','healthcare','education','foodSecurity'].includes(k)?Math.max(0.15,1-(ns2[k]||0)/115):1);});return ns2;});
        if(lvlDef.disc){const dm=g.doctrine==='vanguard'?2:1;S.setDarpaDisc(prev=>{const nd={...prev};Object.entries(lvlDef.disc).forEach(([k,v])=>{nd[k]=(nd[k]||0)+v*dm;});return nd;});}
        fx.toast(`🔬 ${DV[vert].n} L${newLvl} complete — DARPA spillover applied`);
      }
      S.setLog(l=>[{msg:`✅ ${DV[vert].n} → L${newLvl}: ${lvlDef?.n||''}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
    } else { ndr[vert]=ml2; }
  });
  S.setDefResearch(ndr);if(newSpill.size>g.spillApplied.size)S.setSpillApplied(newSpill);

  // Global defense advances (competitors only — player excluded)
  S.setGlobalDef(prev=>{const ng={};Object.entries(prev).forEach(([n,lvls])=>{const rate=(g.moles?.[n]||0)>0?0:(g.sanctions.has(n)?0.006:0.015);ng[n]={};Object.entries(lvls).forEach(([v,l])=>{ng[n][v]=Math.min(5,l+rate);});});return ng;});

  // Competitor sphere pressure
    // ── ESCALATION LADDER: tension bookkeeping (decay, sanctions, blockades) ──
    {const t2={...g.rivalTension};let tCh=false;
      Object.keys(t2).forEach(k=>{if(t2[k]>0){t2[k]=Math.max(0,t2[k]-1);tCh=true;}});
      g.sanctions.forEach(sid=>{if(['usa','russia','china','germany'].includes(sid)&&sid!==c.id){t2[sid]=Math.min(100,(t2[sid]||0)+1+1);tCh=true;}}); // +1 net after decay
      Object.values(g.blockades).forEach(b=>{if(b?.target){t2[b.target]=Math.min(100,(t2[b.target]||0)+2+1);tCh=true;}});
      if(t2[c.id]!==undefined){delete t2[c.id];tCh=true;}
      // Invariant: the player never appears in any rival-keyed structure
      if(g.rivalHolds[c.id]){delete g.rivalHolds[c.id];S.setRivalHolds({...g.rivalHolds});}
      if(g.embargoes.has(c.id)){const e2=new Set(g.embargoes);e2.delete(c.id);g.embargoes=e2;S.setEmbargoes(e2);}
      Object.entries(g.blockades).forEach(([rid,b])=>{if(b?.target===c.id){const n2={...g.blockades};delete n2[rid];g.blockades=n2;S.setBlockades(n2);}});
      Object.keys(t2).forEach(k=>{const rel=g.nationRelations[k]||0;const cap=100-Math.max(0,rel)*0.5;if(t2[k]>cap){t2[k]=cap;tCh=true;}const extra=rel>60?2:rel>30?1:0;if(extra&&t2[k]>0){t2[k]=Math.max(0,t2[k]-extra);tCh=true;}});
      Object.keys(t2).forEach(k=>{if(t2[k]>99)t2[k]=99;if(isAllyOf(c.id,k)&&t2[k]>40){t2[k]=Math.max(40,t2[k]-2);tCh=true;}});if(tCh){g.rivalTension=t2;S.setRivalTension(t2);}}
    // Expulsion clocks
    {const e2={...g.expelled};let eCh=false;Object.keys(e2).forEach(k=>{if(e2[k]>0){e2[k]--;eCh=true;if(e2[k]===0)fx.toast(`${k.charAt(0).toUpperCase()+k.slice(1)} intelligence station re-established`);}});if(eCh)g.expelled=e2;}
    // ── FOREIGN CONCESSIONS: technology for barrels
  g.concessions.forEach(ck=>{const cp=CONCESSIONS[ck];if(!cp||g.stewardship[ck])return; // stewardship supersedes the concession
    const suspended=g.sanctions.has(cp.nation)||(g.nationRelations[cp.nation]||0)<0;
    if(!suspended){cash('Foreign concessions',Math.round(cp.income*(1+Math.max(0,(g.defLevels.materials||4)-4)*0.15)));
      if(g.sphere[cp.region]&&(g.sphere[cp.region].player||0)<95)S.setSphere(p=>({...p,[cp.region]:{...p[cp.region],player:Math.min(100,(p[cp.region]?.player||0)+0.1)}}));}
    const rivalTop=topHostile(g.sphere[cp.region]?.competitors,c.id);
    if(rivalTop&&rivalTop[1]>(g.sphere[cp.region]?.player||0)+25&&rng()<0.05){
      S.setConcessions(prev=>{const n2=new Set(prev);n2.delete(ck);g.concessions=n2;return n2;});
      fx.toast(`🛢️ ${cp.n} lost — ${rivalTop[0]} out-muscled you in ${REGIONS[cp.region]?.n} and Caracas switched partners`);
      S.setLog(l=>[{msg:`🛢️ Concession lost: ${cp.n} → ${rivalTop[0]}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);}});
  // ── ENERGY EMBARGO: withhold barrels from a rival (producer's weapon) — and suffer it if you're dependent
  const producer=(g.resExtraction.oil||0)>=2||(g.resExtraction.gas||0)>=2;
  if(g.embargoes.size&&producer){g.embargoes.forEach(tg=>{
    const s2=g.sphere;let ch=false;const n2={};Object.keys(s2).forEach(rid=>{const v=s2[rid].competitors?.[tg]||0;if(v>0.2){n2[rid]={...s2[rid],competitors:{...s2[rid].competitors,[tg]:Math.max(0,v-0.15)}};ch=true;}else n2[rid]=s2[rid];});if(ch)S.setSphere(n2);});}
  if(g.embargoes.size&&producer){const relE={...g.nationRelations};let eCh=false;g.embargoes.forEach(tg=>{if(!['usa','russia','china','germany'].includes(tg)){relE[tg]=Math.max(-100,(relE[tg]||0)-0.5);eCh=true;}});if(eCh){g.nationRelations=relE;S.setNationRelations(relE);}}
  if(g.embargoes.size&&!producer){S.setEmbargoes(new Set());g.embargoes=new Set();fx.toast('⚠ Embargo lapsed — you no longer produce enough to withhold');}
  // Rival embargo on you: a hostile producer (Russia) at tension ≥60 vs an energy-dependent player
  {const eb=g.embargoedBy;if(eb){const e2={...eb,mo:eb.mo-1};if(e2.mo<=0){g.embargoedBy=null;S.setEmbargoedBy(null);fx.toast(`⛽ ${eb.by} embargo ends — supply normalizes`);}else{g.embargoedBy=e2;S.setEmbargoedBy(e2);}}
    else if((trait.energyDep||0)>0&&c.id!=='russia'&&(g.rivalTension.russia||0)>=60&&rng()<0.05){g.embargoedBy={by:'russia',mo:12};S.setEmbargoedBy({by:'russia',mo:12});fx.toast('⛽ RUSSIA cuts your energy supply — 12 months of squeeze unless you diversify');S.setLog(l=>[{msg:'⛽ Russian energy embargo imposed',yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);}}
  const diversified=isDiversified(g);
  if(g.embargoedBy&&!diversified&&!sprShield){ns.inflation+=0.08;ns.gdpGrowth-=0.03;}
  // ── OIL STEWARDSHIP: you run their ministry — barrels sell through you, proceeds compound as production recovers
  Object.entries(g.stewardship).forEach(([ck,st])=>{const cp=CONCESSIONS[ck];if(!cp)return;
    const nw=navalW(cp.region);const present=nw>=2;
    const st2={...st,mo:present?st.mo+1:st.mo,unrest:Math.max(0,(st.unrest||0)-1)};
    const ramp=1+Math.min(1,st2.mo/24);const tiers=1+0.25*(st2.tiers||0);const mat=1+Math.max(0,(g.defLevels.materials||4)-4)*0.15;
    const paused=st2.unrest>0;
    if(!paused){cash('Oil stewardship',Math.round(cp.intervention.income*ramp*tiers*mat*(present?1:0.5)));cash('Stewardship purchases',60); // proceeds spent on your goods
      S.setNationRelations(p=>({...p,[cp.nation]:Math.min(100,(p[cp.nation]||0)+0.3)}));
      S.setSphere(p=>{const s2=p[cp.region];if(!s2)return p;const comps={...s2.competitors};['china','russia'].forEach(r2=>{if((comps[r2]||0)>0)comps[r2]=Math.max(0,comps[r2]-0.2);});return {...p,[cp.region]:{...s2,player:Math.min(100,(s2.player||0)+0.25),competitors:comps}};});}
    if(!present&&rng()<0.04){st2.unrest=3;S.setStats(p=>({...p,stability:p.stability-3}));fx.toast(`🔥 Unrest in ${NATIONS[cp.nation]?.n} — with no fleet offshore, the ministry stops shipping for 3 months`);S.setLog(l=>[{msg:`🔥 ${NATIONS[cp.nation]?.n} unrest — stewardship paused`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);}
    if(g.blocTrade.opec>=1&&g.tickCount%3===0)S.setNationRelations(p=>({...p,saudi:Math.max(-100,(p.saudi||0)-1),uae:Math.max(-100,(p.uae||0)-1)})); // dumping barrels outside the cartel
    g.stewardship={...g.stewardship,[ck]:st2};});
  if(Object.keys(g.stewardship).length)S.setStewardship({...g.stewardship});
  // ── Platform development programs
  if(Object.keys(g.platformDev).length){const pd={...g.platformDev};let done=[];Object.keys(pd).forEach(pid=>{pd[pid]={mo:pd[pid].mo-1};if(pd[pid].mo<=0){done.push(pid);delete pd[pid];}});
    if(done.length){S.setDeveloped(prev=>{const n2=new Set(prev);done.forEach(d=>n2.add(d));g.developed=n2;return n2;});done.forEach(d=>{fx.toast(`✅ ${PLATFORMS[d].n} — first article delivered, production line open`);S.setLog(l=>[{msg:`✅ ${PLATFORMS[d].n} developed`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);});}
    g.platformDev=pd;S.setPlatformDev(pd);}
  // ── PARIAH clock (post-employment)
  if(g.pariah>0){g.pariah--;S.setPariah(g.pariah);if(g.pariah===0)fx.toast('☢️ Pariah status lifted — arms markets cautiously reopen');}
  // ── BRINK: a rival at ≥85 may issue a nuclear ultimatum (deterrence-damped, one at a time)
  if(!g.ultimatum&&!g.confrontation){
    const tlU=legsOf(g.platforms,g.blackPrograms);
    const nmU=tlU>=3?0.35:tlU===2?0.55:tlU===1?0.75:1;
    Object.entries(g.rivalTension).forEach(([cid,t])=>{if(cid===c.id||isAllyOf(c.id,cid)||(g.nationRelations[cid]||0)>=20)return;
      const gl=g.globalDef[cid]||{};const rs=((gl.aircraft||0)>=5?1:0)+((gl.missiles||0)>=5?1:0)+((gl.naval||0)>=5?1:0);
      if(!g.ultimatum&&t>=85&&rng()<0.08*nmU){g.ultimatum={cid};S.setUltimatum({cid});const e={actor:cid,target:c.id,type:'ultimatum',yr:g.date.yr,mo:g.date.mo};g.nukeLog=[e,...g.nukeLog].slice(0,40);S.setNukeLog(g.nukeLog);}
      else if(t>=90&&rs>=2&&rng()<0.04*nmU){ // rival demonstration against you
        const top=Object.entries(g.sphere).map(([r2,s2])=>[r2,s2.player||0]).sort((a,b)=>b[1]-a[1])[0];
        if(top)S.setSphere(p=>({...p,[top[0]]:{...p[top[0]],player:Math.max(0,(p[top[0]].player||0)-15)}}));
        ns.stability-=8;const e={actor:cid,target:c.id,region:top?.[0],type:'demonstration',yr:g.date.yr,mo:g.date.mo};g.nukeLog=[e,...g.nukeLog].slice(0,40);S.setNukeLog(g.nukeLog);
        fx.toast(`🚨 ${cid.charAt(0).toUpperCase()+cid.slice(1)} DEMONSTRATION STRIKE — a warhead detonated over ${REGIONS[top?.[0]]?.n||'the sea'}. Your position there −15, stability −8`);
        S.setLog(l=>[{msg:`☢ ${cid} demonstration strike`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);}
      else if(t>=99&&rs>=3&&tlU>=2&&rng()<0.03){const e={actor:cid,target:c.id,type:'exchange',yr:g.date.yr,mo:g.date.mo};g.nukeLog=[e,...g.nukeLog].slice(0,40);S.setNukeLog(g.nukeLog);S.setGameOver(`☢️ NUCLEAR EXCHANGE. ${cid.charAt(0).toUpperCase()+cid.slice(1)} launched first at the brink; your forces answered. The register records who fired — history will not.`);}
    });
  }
  // ── BLOCKADES: strangle the target's position; runners test your cordon; heat risks confrontation ──
    if(Object.keys(g.blockades).length){const sphB={...g.sphere};
      const nB=Object.keys(g.blockades).length;
      cash('Blockades',-nB*120);
      const tlB=legsOf(g.platforms,g.blackPrograms);
      const nmB=tlB===3?0.4:tlB===2?0.6:tlB===1?0.8:1;
      Object.entries(g.blockades).forEach(([rid,b])=>{
        if(!b?.target)return;
        const chokeHere=Object.values(CHOKEPOINTS).some(cp=>cp.region===rid);
        const rate=(b.half?0.15:0.3)*(chokeHere?1.5:1);
        if(sphB[rid]?.competitors?.[b.target]>0)sphB[rid]={...sphB[rid],competitors:{...sphB[rid].competitors,[b.target]:Math.max(0,(sphB[rid].competitors[b.target]||0)-rate)}};
        const t=g.rivalTension[b.target]||0;
        if(!b.half&&t>=40&&t<70&&rng()<0.2){
          if(sphB[rid])sphB[rid]={...sphB[rid],competitors:{...sphB[rid].competitors,[b.target]:Math.min(90,(sphB[rid].competitors?.[b.target]||0)+0.5)}};
          const lk=`run_${b.target}`;const last=g.noticeCooldowns[lk]??-99;
          if(g.tickCount-last>=12){g.noticeCooldowns[lk]=g.tickCount;fx.toast(`⚓ ${b.target} blockade runners slipped the ${REGIONS[rid]?.n} cordon`);}
          S.setLog(l=>[{msg:`⚓ Blockade runner — ${REGIONS[rid]?.n}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
        }
        if(t>=70&&!g.confrontation&&g.tickCount-(g.confrontationCooldowns[b.target]??-99)>=24&&rng()<0.15*((t-70)/30)*nmB){g.confrontationCooldowns[b.target]=g.tickCount;
          g.confrontation={rid,target:b.target};S.setConfrontation({rid,target:b.target});
        }
      });
      S.setSphere(sphB);
    }
  m.diversified=diversified;
}

// military: Rival pressure. Runs every month; acts only when the 3-month pressureTimer expires (cadence rule).
function pressure(g,S,fx,m){
  const {c,ns}=m;
  g.pressureTimer--;
  if(g.pressureTimer<=0&&g.gracePeriod<=0){
    g.pressureTimer=3;
    const sphCopy={...g.sphere};
    // Aggregate pressure per rival: ONE response each cycle (scaled by how many regions they contest),
    // toast at most once per rival per 12mo — repeats go to the event log only. Kills notification spam.
    const pressure={};
    Object.entries(REGIONS).forEach(([rid,reg])=>{
      const playerSph=sphCopy[rid]?.player||0;
      if(playerSph>68&&!reg.homeFor?.includes(c.id)){
        reg.contestedBy?.forEach(compId=>{if(compId!==c.id&&!isAllyOf(c.id,compId)&&COMP_RESPONSES[compId]?.length&&g.blockades[rid]?.target!==compId)(pressure[compId]=pressure[compId]||[]).push(rid);});
      }
    });
    const eTier=getEnergyTier(g.resources,g.resExtraction,g.importContracts);
    const shockMult=eTier==='nuclear'?0.25:eTier==='high'?0.5:eTier==='coal'?1.2:1.0;
    const tl=legsOf(g.platforms,g.blackPrograms);
    const nm=tl===3?0.25:tl===2?0.5:tl===1?0.7:1;
    const milM=ns.military>=85?0.5:ns.military>=70?0.75:1;
    Object.entries(pressure).forEach(([compId,rids])=>{
      const responses=COMP_RESPONSES[compId];
      const resp=responses[Math.floor(rng()*responses.length)];
      const moleM=(g.moles?.[compId]||0)>0?0.5:1;
      const detM=Math.min(nm,milM)*moleM;
      const isrDamp=rids.filter(r2=>g.forcePosture[r2]==='isr'&&sumDep(g.forceDeployments?.[r2])>0).length;
      const scale=Math.min(1.6,1+0.2*(rids.length-1))*((g.rivalTension[compId]||0)>=40?1.25:1)*Math.max(0.4,1-0.3*isrDamp)*(g.embargoes.has(compId)?0.75:1);
      S.setStats(p=>{const ns2={...p};Object.entries(resp.effect||{}).forEach(([k,v])=>{if(k in ns2&&typeof v==='number')ns2[k]+=((k==='stability'||k==='inflation')?v*shockMult:v)*detM*scale;});return ns2;});
      rids.forEach(rid=>{
        const wHere=wSum(g.forceDeployments?.[rid],g.blackPrograms);
        const detS=Math.min(nm,milM)*(wHere>0?0.5:1)*moleM;
        const ps=sphCopy[rid]?.player||0;
        if(sphCopy[rid]){sphCopy[rid]={...sphCopy[rid],player:Math.max(0,ps-6*detS),competitors:{...sphCopy[rid].competitors,[compId]:Math.min(90,(sphCopy[rid].competitors?.[compId]||0)+8*detS)}};}
      });
      const last=g.noticeCooldowns[compId]??-99;
      if(g.tickCount-last>=12){g.noticeCooldowns[compId]=g.tickCount;fx.toast(`⚠ ${resp.msg}`);}
      S.setLog(l=>[{msg:`⚔️ ${resp.msg}${rids.length>1?` (${rids.length} regions)`:''}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
    });
    S.setSphere(sphCopy);
  }
}

// intel: Intel op resolution, investigations and issues, cooldowns, agency costs, sanctions, moles, covert programs.
function intelOps(g,S,fx,m){
  const {c,ns,cash}=m;
  // Intel ops
  const newOps=[];
  g.intelOps.forEach(op=>{
    if(op.monthsLeft<=1){
      const tRg=NATIONS[op.targetId]?.region;const misB=(g.embassyMissions[op.targetId]==='intel'?0.12:0)+((tRg&&g.forcePosture[tRg]==='isr'&&sumDep(g.forceDeployments?.[tRg])>0)?0.25:0);
      const success=rng()<Math.min(0.95,op.successRate+misB);
      const discovered=rng()<op.discoverRate;
      if(success&&op.opId==='tech_acq'){
        // Find the vertical where target leads and player is most behind
        const tLvls=g.globalDef[op.targetId]||{};const pLvls=g.defLevels;
        const verts=Object.keys(DV);
        const best=verts.reduce((b,v)=>{const gap=(tLvls[v]||0)-(pLvls[v]||0);return gap>b.gap?{v,gap}:b;},{v:verts[0],gap:-99});
        const stealVert=best.v;
        S.setDarpaDisc(p=>({...p,[stealVert]:Math.min(0.6,(p[stealVert]||0)+0.4)}));
        fx.toast(`💾 ${DV[stealVert]?.n||stealVert} intel extracted — 40% research discount applied`);
      }
      if(success&&op.opId==='destab'){
        // Reduces TARGET sphere, boosts player sphere. Special Activities Wing amplifies ×1.5
        const pAmp=g.intelInfra.paramilitary?1.5:1;
        const dT=Math.round(20*pAmp),dP=Math.round(9*pAmp);
        S.setSphere(p=>{const ns2={...p};Object.entries(ns2).forEach(([rid,sph])=>{
          if((sph.competitors?.[op.targetId]||0)>5){
            ns2[rid]={...sph,player:Math.min(100,(sph.player||0)+dP),
              competitors:{...sph.competitors,[op.targetId]:Math.max(0,(sph.competitors[op.targetId]||0)-dT)}};
          }
        });return ns2;});
        fx.toast(`💣 Destabilization complete — ${op.targetId} sphere −${dT}${pAmp>1?' (Special Activities amplified)':''}`);
      }
      if(success&&op.opId==='sabotage'){
        S.setGlobalDef(p=>{const ng={...p};const tgt=ng[op.targetId];if(tgt){const top=Object.entries(tgt).sort((a,b)=>b[1]-a[1])[0];if(top)ng[op.targetId]={...tgt,[top[0]]:Math.max(0,top[1]-0.8)};}return ng;});
        fx.toast(`💥 Sabotage successful — ${op.targetId}'s leading program set back`);
      }
      if(success&&op.opId==='mole'){
        g.moles={...g.moles,[op.targetId]:24};S.setMoles({...g.moles});
        fx.toast(`🪤 Asset placed inside ${op.targetId} — their pushback halved, R&D frozen for 24mo`);
      }
      if(success&&op.opId==='influence'){
        const tgtRegion=INTEL_TARGETS.find(t=>t.id===op.targetId)?.region;
        if(tgtRegion){S.setSphere(p=>{const n2={...p};const sph=n2[tgtRegion];if(sph){const comps={...sph.competitors};if(comps[op.targetId]!==undefined)comps[op.targetId]=Math.max(0,comps[op.targetId]-6);n2[tgtRegion]={...sph,player:Math.min(100,(sph.player||0)+10),competitors:comps};}return n2;});}
        fx.toast(`🗳️ Influence campaign succeeded — ${REGIONS[tgtRegion]?.n||'region'} shifts toward you (+10 sphere)`);
      }
      if(success&&op.opId==='econ_war'){
        // Economic warfare: player benefits from competitor constraint. Cryptanalysis Center amplifies ×1.5
        const cAmp=g.intelInfra.crypt_center?1.5:1;
        S.setActiveEffects(p=>[...p,
          {id:`ew_t_${fx.now()}`,source:'econ_war',stat:'treasury',d:Math.round(130*cAmp),monthsLeft:6,totalMonths:6},
          {id:`ew_g_${fx.now()}`,source:'econ_war',stat:'gdpGrowth',d:0.12*cAmp,monthsLeft:6,totalMonths:6},
        ]);
        fx.toast(`💸 Economic warfare: ${op.targetId} constrained${cAmp>1?' — Cryptanalysis amplified':''} — your economy benefits`);
      }
      if(discovered){
        const isFriendly=INTEL_TARGETS.find(t=>t.id===op.targetId)?.align==='west';
        S.setIntelCrisis({type:isFriendly?'friendly':'hostile',targetId:op.targetId,opId:op.opId,responses:isFriendly?CRISIS_FRIENDLY:CRISIS_HOSTILE});
        fx.toast('🚨 Intelligence operation discovered! Response required.');
      }
      S.setLog(l=>[{msg:`${success?'✅':'❌'} Intel op vs ${op.targetId}: ${success?'success':'failed'}${discovered?' — DISCOVERED':''}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
    } else { newOps.push({...op,monthsLeft:op.monthsLeft-1}); }
  });
  S.setIntelOps(newOps);

  // Investigations
  const ni={...g.investigations};const nb={...g.briefs};let bc=false;const justBriefed=[];
  Object.entries(ni).forEach(([type,ml])=>{
    if(ml<=1){delete ni[type];const def=ISSUES[type];if(def){nb[type]=def.brief(ns,c);bc=true;justBriefed.push(type);S.setLog(l=>[{msg:`📄 Brief: ${def.title}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);fx.toast(`📄 Brief ready: ${def.title}`);}}else ni[type]=ml-1;
  });
  S.setInvestigations(ni);if(bc)S.setBriefs(nb);

  let issueCool={};
  // Issue lifecycle (issues.js): spawn on a 6-10 month cadence, persist with a ttl, lapse or resolve. No trigger-flip removal.
  {const r=stepIssues({issues:g.issues,deployments:g.deployments,stats:ns,now:g.tickCount,date:g.date,briefed:justBriefed,cooldowns:g.actionCooldowns});issueCool=r.cool;
   S.setIssues(r.issues);
   const lg=(msg)=>S.setLog(l=>[{msg,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
   r.spawned.forEach(t=>{fx.toast(`⚠ ${ISSUES[t].title} — examine within ${ISSUE_TTL.unexamined} months`);lg(`⚠ Issue: ${ISSUES[t].title}`);});
   r.lapsed.forEach(t=>{fx.toast(`⌛ ${ISSUES[t].title} lapsed unaddressed`);lg(`⌛ Lapsed: ${ISSUES[t].title}`);});
   {const gone=[...r.lapsed,...r.resolved].filter(t=>nb[t]);if(gone.length){const nb2={...nb};gone.forEach(t=>{delete nb2[t];});S.setBriefs(nb2);}}
   r.resolved.forEach(t=>lg(`✔ Resolved: ${ISSUES[t].title}`));}

  // Cooldowns
  const ncd={};Object.entries(g.actionCooldowns).forEach(([id,ml])=>{if(ml>1)ncd[id]=ml-1;});Object.assign(ncd,issueCool);S.setActionCooldowns(ncd);

  // Intelligence infrastructure maintenance + monthly agency budget (real money now)
  {let iInf=0;Object.entries(g.intelInfra||{}).forEach(([fid,ct])=>{const f=INTEL_INFRA[fid];if(f&&ct)iInf+=f.maint*ct;});cash('Intel infrastructure',-iInf);}
  cash('Intel agency',-(g.intelBudget||1)*40); // agency operating budget L1=$40M → L5=$200M/mo
  // Sanctions regimes: cost you, slow them
  if(g.sanctions.size>0){cash('Sanctions',-g.sanctions.size*60);ns.gdpGrowth-=g.sanctions.size*0.02;
    // Sanctioning a nation you have positive relations with bleeds those relations (diplomatic cost)
    const relS={...g.nationRelations};let rsCh=false;g.sanctions.forEach(sid=>{if(relS[sid]>-100){relS[sid]=Math.max(-100,(relS[sid]||0)-0.4);rsCh=true;}});if(rsCh)S.setNationRelations(relS);}
  // Moles expire
  if(Object.keys(g.moles).length){const nm2={};Object.entries(g.moles).forEach(([t,m])=>{if(m>1)nm2[t]=m-1;else{fx.toast(`🪤 Asset in ${t} has gone dark — penetration expired`);}});g.moles=nm2;S.setMoles(nm2);}
  // Covert program funding + effects
  {let cvC=0;g.covertPrograms.forEach(cpId=>{const cp=COVERT_PROGRAMS[cpId];if(cp)cvC+=cp.cost;});cash('Covert programs',-cvC);}
  if(g.covertPrograms.has('influence_network')){
    const weak=Object.entries(g.sphere).filter(([,s2])=>(s2.player||0)>10&&(s2.player||0)<60).sort((a,b)=>(a[1].player||0)-(b[1].player||0)).slice(0,2);
    if(weak.length){const sphI={...g.sphere};weak.forEach(([rid])=>{sphI[rid]={...sphI[rid],player:Math.min(100,(sphI[rid].player||0)+0.08)};});S.setSphere(sphI);}
  }
  if(g.covertPrograms.has('disinfo_apparatus')){
    const topRival=Object.entries(g.globalDef).map(([cid])=>{const rs=Object.values(g.sphere).reduce((a,s2)=>a+(s2.competitors?.[cid]||0),0);return[cid,rs];}).sort((a,b)=>b[1]-a[1])[0];
    if(topRival&&topRival[1]>5){const sphD={...g.sphere};Object.keys(sphD).forEach(rid=>{const cv=sphD[rid].competitors?.[topRival[0]]||0;if(cv>3)sphD[rid]={...sphD[rid],competitors:{...sphD[rid].competitors,[topRival[0]]:Math.max(0,cv-0.06)}};});S.setSphere(sphD);}
  }
  if(g.covertPrograms.has('economic_espionage')){
    cash('Economic espionage',70);
    const verts=Object.keys(DV);const best=verts.reduce((b,v)=>(g.defLevels[v]||0)>(g.defLevels[b]||0)?v:b,verts[0]);
    if((g.defLevels[best]||0)<7)g.defLevels={...g.defLevels,[best]:Math.min(7,(g.defLevels[best]||0)+0.0015)};
  }
  if(g.covertPrograms.has('proxy_network')){
    const sphP2={...g.sphere};let hit=false;
    Object.entries(sphP2).forEach(([rid,s2])=>{if((s2.player||0)>20&&(s2.player||0)<80){const top=Object.entries(s2.competitors||{}).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>5){sphP2[rid]={...s2,competitors:{...s2.competitors,[top[0]]:Math.max(0,top[1]-0.05)}};hit=true;}}});
    if(hit)S.setSphere(sphP2);
  }
}

// diplomacy: Defense pacts and trade agreements.
function alliances(g,S,fx,m){
  const {ns,cash}=m;
  // ── Defense pacts: allied nations anchor your sphere in their region + deterrence ──
  if(g.defensePacts.size>0){
    cash('Alliances',-g.defensePacts.size*20); // alliance upkeep
    const sphPact={...g.sphere};let pCh=false;
    g.defensePacts.forEach(nid=>{
      const reg=DIP_TARGETS.find(d=>d.id===nid)?.region;if(reg&&sphPact[reg]){sphPact[reg]={...sphPact[reg],player:Math.min(100,(sphPact[reg].player||0)+0.06)};pCh=true;}
      // Pact erodes if relations collapse below 30
      if((g.nationRelations[nid]||0)<30){S.setDefensePacts(prev=>{const n2=new Set(prev);n2.delete(nid);g.defensePacts=n2;return n2;});fx.toast(`⚠ ${DIP_TARGETS.find(d=>d.id===nid)?.n} defense pact dissolved — relations fell too far`);}
    });
    if(pCh)S.setSphere(sphPact);
    ns.stability+=Math.min(0.04,g.defensePacts.size*0.012); // alliance security
  }
  // ── Trade agreements: ongoing economic income + slow relations growth ──
  if(g.tradeAgreements.size>0){
    // Bilateral income deepens with the relationship — not a flat toggle
    let biInc=0;g.tradeAgreements.forEach(nid=>{biInc+=30+Math.max(0,(g.nationRelations[nid]||0))*0.4;});
    cash('Bilateral trade',Math.round(biInc*(g.doctrine==='hegemon'?1.25:1)));
    const relT={...g.nationRelations};let tCh=false;g.tradeAgreements.forEach(nid=>{if((relT[nid]||0)<100){relT[nid]=Math.min(100,(relT[nid]||0)+0.05);tCh=true;}});if(tCh)S.setNationRelations(relT);
  }
}

// world: World arms demand drift; world events tick and spawn.
function market(g,S,fx,m){
  const {c,ns}=m;
  // ── WORLD MARKET: per-vertical demand drifts; world events shock it ──
  {const d2={...g.demand};Object.keys(DV).forEach(v=>{const cur=d2[v]??1;let ev=0;const we=g.worldEvent;
    if(we){const def=WORLD_EVENTS[we.id];ev=(def?.demand?.[v]||0)+((def?.allMult?def.allMult-1:0));}
    const target=1+ev;
    d2[v]=Math.max(0.7,Math.min(1.5,cur+(target-cur)*0.12+(rng()-0.5)*0.02));});
    g.demand=d2;S.setDemand(d2);}
  // World events (E2, #14): cooldowns tick every month; context-weighted pick; queued follow-ups from answered cards.
  eventCooldowns(g,S);
  if(g.worldEvent){const we={...g.worldEvent};const def=WORLD_EVENTS[we.id];
    Object.entries(def?.fx||{}).forEach(([k,v])=>{if(k in ns)ns[k]+=v;});
    we.mo--; if(we.mo<=0){fx.toast(`${def.i} ${def.n} — conditions normalize`);g.worldEvent=null;S.setWorldEvent(null);}else{g.worldEvent=we;S.setWorldEvent(we);}}
  else if(!fireChain(g,S,fx)&&g.gracePeriod<=0&&rng()<0.045){
    const id=pickWorldEvent(g,rng());
    if(id)startWorldEvent(g,S,fx,id);
  }
}

// diplomacy: Currency posture, embassy expulsions, bloc trade tiers, OPEC swing, influence, embassies, relation decay, proxy funding.
function statecraft(g,S,fx,m){
  const {c,ns,cash}=m;
  if(g.currencyPosture==='usd'&&c.id!=='usa'){cash('Currency posture',30);ns.inflation-=0.02;
    S.setNationRelations(p=>({...p,china:Math.max(-100,(p.china||0)-0.06),russia:Math.max(-100,(p.russia||0)-0.06)}));}
  else if(g.currencyPosture==='dedollar'){ns.inflation+=0.03;
    S.setNationRelations(p=>({...p,china:Math.min(100,(p.china||0)+0.15),russia:Math.min(100,(p.russia||0)+0.12)}));
    if(c.id!=='usa'&&g.tickCount%2===0)S.setRivalTension(p=>({...p,usa:Math.min(100,(p.usa||0)+1)}));
    if(g.blocTrade.cn>=2)cash('Currency posture',40);}
  {const el={...g.embassyLocks};let elCh=false;Object.keys(el).forEach(k=>{if(el[k]>0){el[k]--;elCh=true;}});if(elCh)g.embassyLocks=el;}
  ['china','russia','usa','germany'].forEach(host=>{
    if(host===c.id||!g.embassies.has(host))return;
    if((g.rivalTension[host]||0)>=60&&rng()<0.06){
      S.setEmbassies(prev=>{const n2=new Set(prev);n2.delete(host);g.embassies=n2;return n2;});
      g.embassyLocks={...g.embassyLocks,[host]:12};
      S.setEmbassyMissions(p=>{const n2={...p};delete n2[host];g.embassyMissions=n2;return n2;});
      fx.toast(`🚨 ${host.charAt(0).toUpperCase()+host.slice(1)} EXPELLED your embassy — persona non grata, 12mo before you can return`);
      S.setLog(l=>[{msg:`🚨 Embassy expelled — ${host}`,yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
    }});
  // ── BLOC TRADE ARCHITECTURE: tiered agreements, auto-verified, with real exit costs ──
  {const bt={...g.blocTrade};let btCh=false;
    const avgRel=ids=>ids.reduce((s,i)=>s+(g.nationRelations[i]||0),0)/ids.length;
    const embC=ids=>ids.filter(i=>g.embassies.has(i)).length;
    const pactC=ids=>ids.filter(i=>g.defensePacts.has(i)).length;
    const q={
      eu:  t=>t<=0||( (t<1||avgRel(BLOC_TRADE.eu.members)>=30) && (t<2||(avgRel(BLOC_TRADE.eu.members)>=50&&embC(BLOC_TRADE.eu.members)>=2)) && (t<3||(avgRel(BLOC_TRADE.eu.members)>=70&&pactC(BLOC_TRADE.eu.members)>=1)) ),
      cn:  t=>t<=0||( (t<1||(g.nationRelations.china||0)>=20) && (t<2||(g.nationRelations.china||0)>=45) && (t<3||(g.nationRelations.china||0)>=65) ),
      opec:t=>t<=0||( (t<1||(g.nationRelations.saudi||0)>=25) && (t<2||(g.resExtraction.oil||0)>0) && (t<3||(g.nationRelations.saudi||0)>=60) ),
    };
    // Lockouts count down
    {const bl={...g.blocLock};let blCh=false;Object.keys(bl).forEach(k=>{if(bl[k]>0){bl[k]--;blCh=true;if(bl[k]===0)fx.toast(`${BLOC_TRADE[k].n} doors reopen — the freeze has lifted`);}});if(blCh){g.blocLock=bl;S.setBlocLock(bl);}}
    // Auto-downgrade to highest qualifying tier
    Object.keys(bt).forEach(k=>{while(bt[k]>0&&!q[k](bt[k])){bt[k]--;btCh=true;const lk=`btdn_${k}`;if(g.tickCount-(g.noticeCooldowns[lk]??-99)>=12){g.noticeCooldowns[lk]=g.tickCount;fx.toast(`⚠ ${BLOC_TRADE[k].n} downgraded to Tier ${bt[k]} — commitments no longer met`);}}});
    // OPEC quota discipline at T2+: pump past the quota and you're out
    if(bt.opec>=2&&(g.resExtraction.oil||0)>2){
      bt.opec=0;btCh=true;g.blocLock={...g.blocLock,opec:12};S.setBlocLock({...g.blocLock});
      S.setNationRelations(p=>({...p,saudi:Math.max(-100,(p.saudi||0)-20),uae:Math.max(-100,(p.uae||0)-20)}));
      fx.toast('🛢️ Expelled from OPEC+ — quota violation. Gulf relations −20, doors closed 12mo');
      S.setLog(l=>[{msg:'🛢️ OPEC+ expulsion — quota violation',yr:g.date.yr,mo:g.date.mo},...l.slice(0,19)]);
    }
    // T3 exclusivity friction: deep alignment with one pole erodes the other
    if(bt.eu>=3){S.setNationRelations(p=>({...p,china:Math.max(-100,(p.china||0)-0.1)}));}
    if(bt.cn>=3){S.setNationRelations(p=>{const n2={...p};BLOC_TRADE.eu.members.forEach(m=>{n2[m]=Math.max(-100,(n2[m]||0)-0.15);});return n2;});}
    // Income + tension drips
    if(bt.eu>=2)cash('Bloc agreements',60); if(bt.eu>=3){cash('Bloc agreements',150);const sw={...g.sphere};if(sw.WE){sw.WE={...sw.WE,player:Math.min(100,(sw.WE.player||0)+0.05)};S.setSphere(sw);}}
    if(bt.cn>=2){cash('Bloc agreements',120);if(c.id!=='usa'&&g.tickCount%2===0)S.setRivalTension(p=>({...p,usa:Math.min(100,(p.usa||0)+1)}));}
    if(bt.cn>=3){cash('Bloc agreements',220);if(c.id!=='usa')S.setRivalTension(p=>({...p,usa:Math.min(100,(p.usa||0)+1)}));}
    if(bt.cn>=1)ns.inflation-=0.05;
    if(btCh){g.blocTrade=bt;S.setBlocTrade(bt);}
    // OPEC swing posture runs its course
    if(g.opecSwing){const sw2={...g.opecSwing};sw2.mo--;
      if(sw2.mode==='cut'){ns.inflation+=0.25;if(g.tickCount%2===0)S.setRivalTension(p=>({...p,china:Math.min(100,(p.china||0)+1)}));}
      else{ns.inflation-=0.15;const sr={...g.sphere};let sc=false;Object.keys(sr).forEach(rid=>{if((sr[rid].competitors?.russia||0)>0.2){sr[rid]={...sr[rid],competitors:{...sr[rid].competitors,russia:Math.max(0,sr[rid].competitors.russia-0.1)}};sc=true;}});if(sc)S.setSphere(sr);}
      if(sw2.mo<=0){fx.toast(`🛢️ OPEC+ ${sw2.mode==='cut'?'production cut':'flood'} posture ends`);g.opecSwing=null;S.setOpecSwing(null);}else{g.opecSwing=sw2;S.setOpecSwing(sw2);}}
  }
  // ── Diplomatic influence allocation: distribute a budget pool across nations ──
  const {infPool,iaW,totW}=influencePool(g); // $100M per budget tier
  const relCur={...g.nationRelations};let relChanged=false;
  if(infPool>0&&totW>0){
    cash('Influence ops',-infPool);
    DIP_TARGETS.forEach(t=>{
      const w=iaW[t.id]||0;if(w<=0)return;
      const {gain}=influenceGain(g,ns.stability,t,infPool,totW); // terms shared with the nation sheet (selectors.js)
      relCur[t.id]=Math.min(100,(relCur[t.id]||0)+gain);relChanged=true;
    });
  }
  // Embassy network: upkeep + passive relations floor + counter-intel in-country
  if(g.embassies.size>0){
    cash('Embassies',-g.embassies.size*15);
    g.embassies.forEach(eid=>{const mis=g.embassyMissions[eid];
      relCur[eid]=Math.min(100,(relCur[eid]||0)+(mis==='culture'?2.6:2.0));relChanged=true;
      if(mis==='culture'){const rgn=NATIONS[eid]?.region;if(rgn&&g.sphere[rgn])S.setSphere(p=>({...p,[rgn]:{...p[rgn],player:Math.min(100,(p[rgn]?.player||0)+0.02)}}));}
      if(g.tradeAgreements.has(eid))cash('Embassy facilitation',mis==='trade'?60:25);});
  }
  // Relations decay toward zero when unfunded (no embassy, no allocation)
  DIP_TARGETS.forEach(t=>{
    const funded=(iaW[t.id]||0)>0||g.embassies.has(t.id);
    if(!funded&&relCur[t.id]!==undefined&&Math.abs(relCur[t.id])>1){relCur[t.id]+=relCur[t.id]>0?-0.08:0.08;relChanged=true;}
  });
  // Relations payoff: allies (>60) feed your sphere in their region; hostile (<-40) drifts to top rival
  Object.entries(relCur).forEach(([nid,rv])=>{
    const reg=DIP_TARGETS.find(d=>d.id===nid)?.region;if(!reg||!g.sphere[reg])return;
    if(rv>60){const sp=g.sphere[reg];S.setSphere(p=>({...p,[reg]:{...p[reg],player:Math.min(100,(p[reg]?.player||0)+0.04)}}));}
  });
  if(relChanged)S.setNationRelations(relCur);
  // ── Proxy funding allocation: distribute covert pool across REGIONS for sphere ──
  const proxPool=(g.proxyBudget||0)*80; // $80M per tier
  const paW=g.proxyAlloc||{};const ptotW=Object.values(paW).reduce((a,b)=>a+(b||0),0);
  if(proxPool>0&&ptotW>0){
    cash('Proxy operations',-proxPool);
    const sphPx={...g.sphere};let pxHit=false;
    Object.keys(REGIONS).forEach(rid=>{
      const w=paW[rid]||0;if(w<=0||!sphPx[rid])return;
      const share=proxPool*(w/ptotW);
      const gain=Math.min(1.4,(share/120)*(g.doctrine==='shadow'?1.5:1));
      const top=Object.entries(sphPx[rid].competitors||{}).sort((a,b)=>b[1]-a[1])[0];
      sphPx[rid]={...sphPx[rid],player:Math.min(100,(sphPx[rid].player||0)+gain),
        competitors:top&&top[1]>3?{...sphPx[rid].competitors,[top[0]]:Math.max(0,top[1]-gain*0.5)}:sphPx[rid].competitors};
      pxHit=true;
    });
    if(pxHit)S.setSphere(sphPx);
  }
}

// intel: Continuous ops; foreign operations against the player (an empty attacker pool ends the month here, as in v57).
function counterIntel(g,S,fx,m){
  const {c,ns,cash}=m;
  // Continuous intel operations: standing programs auto-relaunch against their target each cycle
  if(Object.keys(g.continuousOps||{}).length){
    Object.entries(g.continuousOps).forEach(([opKey,on])=>{
      if(!on)return;const [opId,targetId]=opKey.split('@');
      const op=INTEL_OPS.find(o=>o.id===opId);if(!op)return;
      const running=g.intelOps.some(o=>o.opId===opId&&o.targetId===targetId);
      if(!running){
        const monthlyCost=Math.round((op.cost/Math.max(1,op.mo))*1.6); // ~1.6x premium for standing posture
        if((ns.treasury)>=monthlyCost){
          cash('Intel operations',-monthlyCost);
          S.setIntelOps(p=>[...p,{opId,targetId,monthsLeft:op.mo,totalMonths:op.mo,continuous:true}]);
        }
      }
    });
  }
  // Foreign intelligence operations AGAINST the player — scales with how much you have worth stealing.
  // The more advanced your tech and the more black programs you hold, the harder rivals come for you.
  g.foreignOpTimer++;
  const playerDL=Object.values(g.defLevels).reduce((a,b)=>a+(b||0),0);
  const blackCount=Object.keys(g.blackPrograms||{}).length;
  const targetValue=playerDL/70+blackCount*0.5; // 0..~1.5+
  const maxTen=Math.max(0,...Object.values(g.rivalTension).map(v=>v||0),0);
  const cnExpose=cnExposure(g); // corridor tech comes with listeners
  const opRate=Math.min(0.8,0.22+targetValue*0.22+maxTen/300+cnExpose); // advanced powers + hot rivalries face far more espionage
  const opInterval=Math.max(5,9-Math.floor(targetValue*3));
  if(g.foreignOpTimer>=opInterval&&g.gracePeriod<=0&&rng()<opRate){
    g.foreignOpTimer=0;
    // Russia & China are the aggressive collectors; they hit advanced targets hardest
    const pool=['russia','china','russia','china','usa','germany'].filter(a=>a!==c.id&&((!isAllyOf(c.id,a)&&(g.nationRelations[a]||0)<60)||rng()<0.3));
    if(!pool.length)return STOP; // v57: an empty attacker pool ends the whole month here
    const atk=pool[Math.floor(rng()*pool.length)];
    const intercept=interceptChance(g); // one formula with the E7 counter-intel floor (formulas.js)
    const atkName=atk.charAt(0).toUpperCase()+atk.slice(1);
    if((g.expelled[atk]||0)>0){ /* their station expelled — no operations against you */ }
    else {
    const burned=!!g.disinfo[atk];if(burned)delete g.disinfo[atk];
    if(burned||rng()<intercept){
      ns.stability+=1;
      // ── INTEL RESPONSE DOCTRINE: interception is an opportunity, not just a save ──
      if(burned){
        fx.toast(`📡 Disinformation burned — ${atkName}'s operation collapsed on false product`);
        S.setLog(p=>[{msg:`📡 Disinfo burn: ${atkName}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
      } else if(g.intelPosture==='expose'){
        S.setRivalTension(p=>({...p,[atk]:Math.min(100,(p[atk]||0)+((g.nationRelations[atk]||0)>=60?3:8))}));
        S.setSphere(p=>{const n2={...p};const top=Object.entries(n2).map(([rid,s])=>[rid,s.competitors?.[atk]||0]).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>2){n2[top[0]]={...n2[top[0]],competitors:{...n2[top[0]].competitors,[atk]:Math.max(0,top[1]-2)}};}return n2;});
        fx.toast(`🗞️ Publicly exposed ${atkName} operation — their standing damaged, tension rising`);
        S.setLog(p=>[{msg:`🗞️ Exposed ${atkName} operation`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
      } else if(g.intelPosture==='expel'){
        g.expelled={...g.expelled,[atk]:24};
        S.setRivalTension(p=>({...p,[atk]:Math.min(100,(p[atk]||0)+5)}));
        fx.toast(`✈️ ${atkName} intelligence station expelled — their operations against you blind for 24mo`);
        S.setLog(p=>[{msg:`✈️ Expelled ${atkName} station`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
      } else {
        if(rng()<0.30){
          g.moles={...g.moles,[atk]:12};S.setMoles({...g.moles});
          fx.toast(`🕳️ ${atkName} officer flipped in place — you now have a mole (12mo)`);
          S.setLog(p=>[{msg:`🕳️ Flipped ${atkName} officer`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
        } else {
          g.disinfo={...g.disinfo,[atk]:true};
          fx.toast(`🛡️ Quietly turned the ${atkName} approach — disinformation seeded for their next move`);
          S.setLog(p=>[{msg:`🛡️ Intercepted ${atkName} op — disinfo seeded`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
        }
      }
    } else {
      S.setRivalTension(p=>({...p,[atk]:Math.min(100,(p[atk]||0)+3)}));
      // If you hold black programs, rivals prioritize stealing them — the crown jewels
      const stealableBlack=Object.keys(g.blackPrograms||{});
      const goForBlack=stealableBlack.length>0&&rng()<0.4;
      let ot='steal';
      if(goForBlack){
        const stolen=stealableBlack[Math.floor(rng()*stealableBlack.length)];ot='blacktheft';
        // Attacker gains a major GDB boost in the program's key vertical
        const bp=BLACK_PROGRAMS[stolen];const kv=bp.kv||Object.keys(bp.req)[0];
        S.setGlobalDef(p=>{const ng={...p};if(ng[atk])ng[atk]={...ng[atk],[kv]:Math.min(5,(ng[atk][kv]||0)+1.2)};return ng;});
        fx.toast(`🚨 CLASSIFIED BREACH — ${atkName} exfiltrated ${bp.n} designs`);
      } else {
        const opTypes=['steal','destab','econ'];ot=opTypes[Math.floor(rng()*opTypes.length)];
        if(ot==='steal'){const verts=Object.keys(DV);const v=verts.reduce((b,vv)=>(g.defLevels[vv]||0)>(g.defLevels[b]||0)?vv:b,verts[0]);S.setGlobalDef(p=>{const ng={...p};if(ng[atk])ng[atk]={...ng[atk],[v]:Math.min(5,(ng[atk][v]||0)+0.5)};return ng;});}
        else if(ot==='destab'){ns.stability-=4;}
        else {ns.inflation+=1.2;ns.treasury-=250;}
      }
      if(goForBlack||rng()<0.55){
        S.setRivalTension(p=>({...p,[atk]:Math.min(100,(p[atk]||0)+10)}));
        S.setIntelCrisis({type:'stolen',targetId:atk,opId:ot,responses:CRISIS_STOLEN});
        if(!goForBlack)fx.toast(`🚨 ${atkName} operation detected on your soil — choose your response`);
      } else {
        S.setLog(p=>[{msg:`⚠ Suspected foreign interference (${ot}) — attribution unclear`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
      }
    }
    }
  }
}

// world: Flashpoints, sphere trend, decisions, sector maturity, date, grace period, game over, hegemony race, victory paths, rival holds.
function world(g,S,fx,m){
  const {c,ns,led}=m;
  // Regional flashpoints: spawn, count down, auto-resolve against player if ignored
  if(g.flashpoint){
    const nt=g.flashpoint.t-1;
    if(nt<=0){
      const rid=g.flashpoint.rid;
      const rname=REGIONS[rid]?.n||rid;
      const fpLogEntry={msg:`⚠ ${rname} flashpoint ignored — rival gains`,yr:g.date.yr,mo:g.date.mo};
      S.setSphere(p=>{const n2={...p};const sph=n2[rid];if(sph){const top=Object.entries(sph.competitors||{}).sort((a,b)=>b[1]-a[1])[0];n2[rid]={...sph,player:Math.max(0,(sph.player||0)-5),competitors:top?{...sph.competitors,[top[0]]:Math.min(100,top[1]+12)}:sph.competitors};}return n2;});
      fx.toast(`⚠ Flashpoint in ${rname} resolved against you — rivals filled the vacuum`);
      S.setLog(p=>[fpLogEntry,...p.slice(0,19)]);
      g.flashpoint=null;S.setFlashpoint(null);
    } else {g.flashpoint={...g.flashpoint,t:nt};S.setFlashpoint({...g.flashpoint});}
  } else if(g.gracePeriod<=0&&rng()<0.08){
    const rids=Object.keys(REGIONS).filter(r=>{const pv=g.sphere[r]?.player||0;return pv>15&&pv<75;});
    if(rids.length){
      const rid=rids[Math.floor(rng()*rids.length)];
      const types=Object.keys(FLASHPOINTS);const type=types[Math.floor(rng()*types.length)];
      const fp={rid,type,t:6+(g.intelInfra.isr_fusion?3:0)};g.flashpoint=fp;S.setFlashpoint(fp);
      fx.toast(`${FLASHPOINTS[type].i} ${FLASHPOINTS[type].n} — ${REGIONS[rid].n}. Respond on the map.`);
      S.setLog(p=>[{msg:`${FLASHPOINTS[type].i} ${FLASHPOINTS[type].n}: ${REGIONS[rid].n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
    }
  }
  eventEffects(g,S,ns,m.cash);
  // Sphere momentum tracking (6-month deltas for map arrows)
  g.trendTimer=(g.trendTimer||0)+1;
  if(g.trendTimer>=6){
    g.trendTimer=0;
    const snap=g.sphereSnapshot||{};const tr={};const newSnap={};
    Object.entries(g.sphere).forEach(([rid,sph])=>{const pv=sph.player||0;tr[rid]=pv-(snap[rid]!==undefined?snap[rid]:pv);newSnap[rid]=pv;});
    S.setSphereTrend(tr);g.sphereSnapshot=newSnap;
  }
  // Decisions
  g.decisionTimer--;
  if(g.decisionTimer<=0&&!g.activeDecision){
    const dctx={ns,ten:g.rivalTension,rel:g.nationRelations,bt:g.blocTrade,ex:g.defExports,dl:g.defLevels};
    const avail=DECISIONS.filter(d=>!g.usedDecisions.has(d.id)&&(!d.when||d.when(dctx)));
    if(avail.length){const d=avail[Math.floor(rng()*avail.length)];S.setActiveDecision(d);g.activeDecision=d;fx.toast(`🎯 Decision: ${d.title}`);}
    else g.decisionTimer=g.usedDecisions.size>=DECISIONS.length?12:4; // the pool never resets: nothing eligible means quiet months
  }

  // ── Maturity + sector-level change detection ─────────────────────────────
  const csl={
    defense:Object.values(g.defLevels).reduce((s,v)=>s+(v||0),0),
    energy:Object.values(g.resExtraction).reduce((s,v)=>s+(v||0),0),
    healthcare:Math.floor((ns.healthcare||0)/20),
    education:Math.floor((ns.education||0)/20),
    technology:Object.keys(g.defResearch).length,
  };
  const newMat={...g.sectorMaturity};
  Object.keys(csl).forEach(s=>{
    if(csl[s]!==g.prevSectorLevels[s])newMat[s]=0;
    else newMat[s]=(newMat[s]||0)+1;
  });
  g.prevSectorLevels=csl;S.setSectorMaturity(newMat);g.sectorMaturity=newMat;
  S.setDate(p=>({yr:p.mo===11?p.yr+1:p.yr,mo:(p.mo+1)%12}));
  // Grace period: decrement counter, bypass catastrophic game-over
  if(g.gracePeriod>0){
    g.gracePeriod--;S.setGracePeriod(p=>Math.max(0,p-1));
    // Softer limits during onboarding
    if(ns.treasury<-12000)S.setGameOver('Treasury crisis beyond all limits.');
    if(ns.stability<2)S.setGameOver('Complete societal breakdown.');
  } else {
    if(ns.treasury<-4000)S.setGameOver('Treasury exhausted. The government has defaulted.');
    if(ns.stability<5)S.setGameOver('Regime collapse. Institutional authority has disintegrated.');
    // ── Hegemony race: first to threshold wins the era ──
    const totDL2=Object.values(g.defLevels).reduce((a,b)=>a+(b||0),0);
    const sphVals=Object.values(g.sphere).map(s2=>s2.player||0);
    const avgSph=sphVals.length?sphVals.reduce((a,b)=>a+b,0)/sphVals.length:0;
    const pE=Math.min(100,(Math.max(0,ns.treasury)/20000)*50+Math.max(0,ns.gdpGrowth)*6);
    const pM=ns.military;
    const pI=avgSph;
    const pT=Math.min(100,ns.education*0.4+(totDL2/70)*100*0.6);
    const heg=(pE+pM+pI+pT)/4;
    if(heg>=85){const nh=(g.hegHold||0)+1;g.hegHold=nh;S.setHegHold(nh);if(nh>=24&&!g.victory){g.victory=true;S.setVictoryType('hegemony');S.setVictory(true);}}
    else if(g.hegHold>0){g.hegHold=0;S.setHegHold(0);}
    // ── PATHS TO VICTORY: reward the engine you actually built (each a 24-month hold) ──
    {const ph={...g.pathHold};
      const ledNet=Object.values(led).reduce((a,b)=>a+b,0);
      const econOk=ledNet>=600&&(g.blocTrade.eu>=3||g.blocTrade.cn>=3)&&ns.stability>=70;
      const totRDv=Object.values(g.defLevels).reduce((a,b)=>a+(b||0),0);
      const rivalAvg2=Object.values(g.globalDef).reduce((a,l)=>a+Object.values(l).reduce((x,y)=>x+(y||0),0),0)/Math.max(1,Object.keys(g.globalDef).length);
      const lead2=1+(totRDv-rivalAvg2)/40;
      const techOk=totRDv>=55&&g.usedTech.has('t9')&&lead2>=1.6;
      const dipOk=g.defensePacts.size>=5&&g.embassies.size>=6&&g.dominance.count>=3;
      ph.econ=econOk?ph.econ+1:0;ph.tech=techOk?ph.tech+1:0;ph.dip=dipOk?ph.dip+1:0;
      g.pathHold=ph;S.setPathHold(ph);
      if(!g.victory){const win=ph.econ>=24?'econ':ph.tech>=24?'tech':ph.dip>=24?'dip':null;if(win){g.victory=true;S.setVictoryType(win);S.setVictory(true);}}
    }
    // Symmetric race: rivals win the same way you do — hold 85 for 24 consecutive months.
    // Knocking their sphere down (kinetic, destab, suppression, moles) resets their clock.
    let holdsChanged=false;
    Object.entries(g.globalDef).forEach(([cid,lvls])=>{
      const rAvg=Object.values(lvls).reduce((a,b)=>a+b,0)/Math.max(1,Object.keys(lvls).length);
      const rSph=Object.values(g.sphere).reduce((a,s2)=>a+(s2.competitors?.[cid]||0),0)/Math.max(1,sphVals.length);
      const rScore=(rAvg/5)*55+rSph*0.45;
      const prev=g.rivalHolds[cid]||0;
      if(isAllyOf(c.id,cid)){if(prev>0){g.rivalHolds[cid]=0;holdsChanged=true;}return;}
      if(rScore>=85&&rScore>heg){
        g.rivalHolds[cid]=prev+1;holdsChanged=true;
        if(prev+1===1)fx.toast(`⚠ ${cid.toUpperCase()} has entered hegemony threshold — 24mo to dethrone them`);
        if(g.rivalHolds[cid]>=24)S.setGameOver(`${cid.toUpperCase()} held global hegemony for two years unchallenged. Your strategic window has closed.`);
      } else if(prev>0){g.rivalHolds[cid]=0;holdsChanged=true;}
    });
    if(holdsChanged)S.setRivalHolds({...g.rivalHolds});
  }
}

export const MONTH_PHASES=[
  {id:'economy',system:'economy',run:economy},
  {id:'research',system:'military',run:research},
  {id:'pressure',system:'military',run:pressure},
  {id:'intelOps',system:'intel',run:intelOps},
  {id:'alliances',system:'diplomacy',run:alliances},
  {id:'market',system:'world',run:market},
  {id:'statecraft',system:'diplomacy',run:statecraft},
  {id:'counterIntel',system:'intel',run:counterIntel},
  {id:'world',system:'world',run:world},
];

// One month of v57. Returns false when a phase ended the month early (no country yet, or an empty attacker pool).
export function runMonth(g,S,fx){
  const m={};
  for(const p of MONTH_PHASES){if(p.run(g,S,fx,m)===STOP)return false;}
  return true;
}

// ── Target API (scaffold, P3+): pure tick(state, actions, rng) over the new state model. Not used by the v57 UI yet.
const LOG_CAP = 500;

// State is plain JSON by contract; a JSON round-trip is the clone AND the enforcement (drops functions/undefined, NaN -> null).
export const clone = (v) => JSON.parse(JSON.stringify(v));

// The one entry point. Pure: same (state, actions, rng-stream) => same output. No React, no DOM, no clock.
export function tick(state, actions = [], rng) {
  if (!rng || typeof rng.next !== 'function') {
    throw new Error('tick(state, actions, rng): rng is required (src/sim/rng.js makeRng)');
  }
  let s = clone(state);
  for (const a of actions) s = applyAction(s, a, rng);
  s.month += 1;
  for (const sys of MONTHLY_SYSTEMS) {
    s = sys.run(s, rng);
    s.systems.lastRun[sys.id] = s.month;
  }
  s = purgeSelf(s);
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
  assertInvariants(s);
  return s;
}

// Structural guarantee (v56 ruling): the player can never appear as their own rival.
export function purgeSelf(s) {
  s.rivals = s.rivals.filter((id) => id !== s.player);
  delete s.tension[s.player];
  return s;
}
