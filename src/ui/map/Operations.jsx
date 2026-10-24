import { DeploymentPicker } from './DeploymentPicker.jsx';
import { useState } from 'react';
import { SITES, NODE_TYPES } from '../../data/bases.js';
import { REGIONS, POSTURE_LABELS } from '../../data/regions.js';
import { NATIONS } from '../../data/nations.js';
import { CHOKEPOINTS } from '../../data/chokepoints.js';
import { siteView, chokesCovered, regionsCovered } from '../../sim/bases.js';
import { deploymentOptions } from '../../sim/deployment-view.js';
import { Facility } from './Facility.jsx';
import { buildLines } from './SiteSheet.jsx';
import { ReserveControls } from '../energy/EnergyDesk.jsx';
import { energySituation, protectionWeight } from '../../sim/energy-view.js';
const money=n=>`$${n.toLocaleString('en-US')}M`;
export function Operations({mode,g,selection,previewType,onPreview,onSelect,onClose,onDetails,onNation,onJump,dispatch,ask,build}) {
  const energy=energySituation(g);
  const [query,setQuery]=useState('');
  const find=query.trim().toLowerCase();
  const matches=Object.entries(SITES).filter(([,s])=>`${s.n} ${NATIONS[s.host]?.n||s.local} ${REGIONS[s.region].n}`.toLowerCase().includes(find));
  const choose=(kind,id)=>{setQuery('');onSelect({kind,id});};
  const rid=selection?.kind==='region'?selection.id:selection?.kind==='choke'?CHOKEPOINTS[selection.id].region:null;
  const cp=selection?.kind==='choke'?CHOKEPOINTS[selection.id]:null;
  const site=selection?.kind==='site'?siteView(g,selection.id):null;
  const opt=site?.options.find(o=>o.type===previewType)||site?.options[0];
  const title=site?.n||cp?.n||(rid?REGIONS[rid].n:selection?.kind==='cluster'?'Nearby facilities':'Operations');
  const units=rid?deploymentOptions(g,rid):[];
  const stationed=units.reduce((n,o)=>n+o.here,0);
  return <aside className="wl-operations" data-map-inspector aria-label="Map operations">
    <label className="wl-map-search"><span>LOCATE A SITE</span><input aria-label="Find a base or host nation" placeholder="Search bases or host nations…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="wl-operations-scroll">
      {find?<><p className="wl-map-muted">{matches.length} matching sites</p>{matches.map(([id,s])=><button className="wl-map-row" key={id} onClick={()=>choose('site',id)}><Facility type={s.types[0]}/><span><b>{s.n}</b><small>{NATIONS[s.host]?.n||s.local}</small></span><span>›</span></button>)}</>:<>
      <div className="wl-operations-head"><div><span className="wl-map-eyebrow">{site?'FACILITY / CONSTRUCTION':cp?'MARITIME CORRIDOR':rid?'THEATER COMMAND':'WORLD LEADERS'}</span><h3>{title}</h3></div>{selection&&<button className="wl-map-close" aria-label="Clear map selection" onClick={onClose}>×</button>}</div>
      {!selection&&mode==='energy'&&<><div className="wl-map-facts"><div><b>{money(energy.imports)}</b><span>Imports / month</span></div><div><b>{energy.tier}</b><span>Power tier</span></div></div>{energy.routes.map(r=><button key={r.id} className="wl-map-row" data-inspect-route={r.id} onClick={()=>choose('choke',r.id)}><span>◇</span><span><b>{r.n}</b><small>{r.status} · protection {r.weight.toFixed(1)} / 2</small></span><span>›</span></button>)}<ReserveControls g={g} dispatch={dispatch}/><button className="wl-map-secondary" onClick={()=>onJump?.('energy')}>Energy decisions & observed costs ↗</button></>}
      {!selection&&mode!=='energy'&&<><div className="wl-map-intro"><span className="wl-atlas-mark">⌖</span><b>{build?'Choose a construction site':'Your world. Your next move.'}</b><p>{build?'Find a host, preview a facility and review its cost before committing.':'Select a theater to station forces. Zoom in to inspect facilities and their reach.'}</p></div><span className="wl-map-eyebrow">THEATERS</span><div className="wl-theater-grid">{Object.entries(REGIONS).map(([id,r])=><button data-locate-region={id} key={id} onClick={()=>choose('region',id)}>{r.n}<span>{Math.round(g.sphere?.[id]?.player||0)}% influence</span></button>)}</div><div className="wl-map-shortcuts"><button onClick={()=>onJump?.('economy')}>National budget ↗</button><button onClick={()=>onJump?.('energy')}>Energy & reserves ↗</button></div></>}
      {selection?.kind==='cluster'&&<><p className="wl-map-muted">These facilities share a small area. Choose one to inspect it.</p>{selection.ids.map(id=><button className="wl-map-row" key={id} onClick={()=>choose('site',id)}><Facility type={SITES[id].types[0]}/><span><b>{SITES[id].n}</b><small>{NATIONS[SITES[id].host]?.n||SITES[id].local}</small></span></button>)}</>}
      {site&&opt&&<>
        <div className="wl-facility-preview"><Facility type={opt.type} large/><span>{opt.have?opt.have.status==='building'?`Construction · ${opt.have.mo} months left`:opt.have.status==='active'?'Operational facility':'Host access suspended':'Proposed facility'}</span><b>{NODE_TYPES[opt.type].n}</b></div>
        <button className="wl-map-host" onClick={()=>onNation?.(site.host)} disabled={!site.host}>Host: {site.hostName} <span>{site.host?'↗':''}</span></button>
        <div className="wl-map-type-grid" role="group" aria-label="Facility type">{site.options.map(o=><button key={o.type} data-preview-type={o.type} aria-pressed={opt.type===o.type} onClick={()=>onPreview(o.type)} title={o.n}><Facility type={o.type}/><span>{o.n.replace(' base','').replace(' node','')}</span></button>)}</div>
        <div className="wl-map-facts"><div><b>{opt.private?'$0':money(opt.capex)}</b><span>{opt.private?'Private capital':'Construction'}</span></div><div><b>{money(opt.upkeep+opt.host)}</b><span>Monthly online</span></div><div><b>{opt.mo} mo</b><span>Build time{opt.private?'*':''}</span></div></div>
        {opt.private&&<p className="wl-map-muted">*Private construction depends on investment conditions.</p>}
        <div className="wl-map-reach"><span className="wl-map-eyebrow">{opt.have?.status==='active'?'ACTIVE REACH':'PLANNED REACH'} · {opt.reach?`${opt.reach.toLocaleString('en-US')} km`:'Local'}</span><p>{chokesCovered({site:site.id,type:opt.type}).map(k=>CHOKEPOINTS[k].n).join(' · ')||'No maritime chokepoint in reach'}</p><small>{regionsCovered({site:site.id,type:opt.type}).map(r=>REGIONS[r].n).join(' · ')}</small></div>
        {opt.reason&&<p className="wl-map-gate" data-build-gate>{opt.reason}</p>}
        <p className="wl-map-muted">Map coverage is approximate. The listed theaters and chokepoints use geographic distance.</p>
        <button className="wl-map-primary" data-map-build disabled={!opt.ok} onClick={()=>ask({title:`${opt.n} · ${site.n}`,cost:opt.private?'Authorize: $0 (private capital)':`${money(opt.capex)} now`,kind:'warn',label:opt.private?'Authorize':'Build',lines:buildLines(site,opt,g.country.id),run:()=>dispatch({type:'buildNode',payload:{site:site.id,type:opt.type}})})}>{opt.have?'Facility already placed':opt.private?'Authorize private construction':'Review construction →'}</button>
        <button className="wl-map-secondary" onClick={()=>onDetails('site',site.id)}>Manage facilities & host access ↗</button>
      </>}
      {rid&&<>
        {cp&&<><div className="wl-corridor-state" data-corridor-state={g.chokeStatus?.[selection.id]||'open'}><i/>{g.chokeStatus?.[selection.id]||'open'}</div><p className="wl-map-muted">{cp.d}</p><div className="wl-map-facts"><div><b>{Math.round(cp.oilShare*100)}%</b><span>World oil transit</span></div><div><b>{protectionWeight(g,selection.id).toFixed(1)} / 2</b><span>Fleet + base protection</span></div></div><p className="wl-map-muted">Fleet and nearby bases contribute protection. Set Escort posture in {REGIONS[rid].n} with weight 2+ to protect access. Chokepoint state updates each month.</p></>}
        {!cp&&<div className="wl-map-facts"><div><b>{Math.round(g.sphere?.[rid]?.player||0)}%</b><span>Regional influence</span></div><div><b>{stationed}</b><span>Units stationed</span></div></div>}
        {cp&&energy.routes.some(r=>r.id===selection.id)&&<ReserveControls g={g} dispatch={dispatch}/>}
        {REGIONS[rid].homeFor?.includes(g.country.id)&&<p className="wl-map-muted" data-home-territory>Home territory. Regional influence measures alignment across neighboring countries; it is not control of your domestic territory.</p>}
        <span className="wl-map-eyebrow">FORWARD DEPLOYMENT</span>
        <DeploymentPicker key={rid} units={units} region={rid} dispatch={dispatch}/>
        <label className="wl-map-posture">Mission posture<select aria-label="Mission posture" value={g.forcePosture?.[rid]||'deter'} disabled={!stationed} onChange={e=>dispatch({type:'setPosture',payload:{region:rid,posture:e.target.value}})}>{Object.entries(POSTURE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <p className="wl-map-muted">{stationed?'Deployment is theater-wide. Basing costs $4M per unit each month.':'Station a unit to assign its mission.'}</p>
        <div className="wl-map-shortcuts"><button onClick={()=>onJump?.('forces')}>Forces & readiness ↗</button>{cp&&<button onClick={()=>onJump?.('energy')}>Energy & reserves ↗</button>}</div>
        <details className="wl-map-sites"><summary>Facilities in this theater</summary>{Object.entries(SITES).filter(([,s])=>s.region===rid).map(([id,s])=><button className="wl-map-row" key={id} onClick={()=>choose('site',id)}><Facility type={s.types[0]}/><b>{s.n}</b><span>›</span></button>)}</details>
        <button className="wl-map-secondary" onClick={()=>onDetails('region',rid)}>Diplomacy, crises & all theater actions ↗</button>
      </>}
      </>}
    </div>
  </aside>;
}
