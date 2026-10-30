import {useEffect,useRef,useState} from 'react';
import {REGIONS,POSTURE_LABELS} from '../../data/regions.js';
import {servicesFor,serviceMeta} from '../../data/services.js';
import {packageView,packageOrder} from '../../sim/force-packages.js';
import {useClockHold} from '../shell/ClockGate.jsx';
import {FORCE_PACKAGE_CSS} from './package-styles.js';

const money=n=>`$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})}M/mo`;
const status=p=>!p.ready?'Needs attention':p.region?'Assigned':'Available';
const reduced=p=>Number.isFinite(p.readiness)?p.readiness<.999:(p.components||[]).some(c=>Number.isFinite(c.readiness)&&c.readiness<.999);
const readinessLabel=p=>!p.ready?'Readiness limited':reduced(p)?'Reduced strength':'Mission-ready';
const missionName=id=>POSTURE_LABELS[id]||id||'Unassigned';
const locationName=p=>p.region?REGIONS[p.region]?.n||p.region:'Home / available';
const serviceName=(g,id)=>serviceMeta(g.country.id,id)?.name||id;

function PackageComposition({p,g}){
 return <details className="wl-package-composition" data-package-composition>
  <summary>Composition · {p.components?.length||0} component types</summary>
  {p.description&&<p className="wl-package-note">{p.description}</p>}
  <div>{(p.components||[]).map((c,i)=><div className="wl-package-component" key={`${c.id}-${i}`}><div><b>{c.name||c.id}</b>{c.service&&<small>{serviceName(g,c.service)}</small>}{Number.isFinite(c.readyPlatforms)&&Number.isFinite(c.platforms)&&<small>{c.readyPlatforms} / {c.platforms} mission-ready platforms</small>}{c.note&&<small>{c.note}</small>}{c.block&&<small className="wl-package-warning">{c.block}</small>}</div><strong>×{c.count??1}</strong></div>)}</div>
  <p className="wl-package-note">Components remain owned by their services. This package reserves them for one assignment.</p>
 </details>;
}

function OrderReview({order,onCancel,onConfirm,reviewRef}){
 return <section ref={reviewRef} className="wl-package-quote" data-package-quote aria-label="Review package order" tabIndex={-1}>
  <span className="wl-eyebrow">Review order · clock paused</span><h4>{order.title||'Package order'}</h4>
  <div className="wl-package-quote-cost"><strong>{money(order.costMonthly)}</strong><span>{order.costDelta>0?'+':order.costDelta<0?'−':''}{money(Math.abs(order.costDelta||0))} change</span></div>
  {(order.lines||[]).map((line,i)=><p key={i}>{line}</p>)}
  {order.block&&<p className="wl-package-warning" role="status">{order.block}</p>}
  <div className="wl-package-action-pair" data-package-review-actions><button type="button" className="wl-btn" data-package-cancel onClick={onCancel}>Cancel</button><button type="button" className="wl-btn wl-btn-primary" data-package-confirm disabled={!!order.block} onClick={onConfirm}>Confirm order</button></div>
 </section>;
}

function PackageReadiness({p}){
 return <div className="wl-package-state"><span className="wl-package-status" data-status={p.ready&&!reduced(p)?'ready':'limited'}>{readinessLabel(p)}</span><strong>{money(p.costMonthly??p.monthlyCost)}</strong></div>;
}

// The full Forces workspace and compact map inspector share the same selector, quote and atomic verbs.
export function ForcePackageDesk({g,region,initialPackage,initialMission,dispatch,onJump,compact=false,onRegion,onPackage}){
 const v=packageView(g),packages=v.packages||[],services=v.services||servicesFor(g.country.id);
 const [service,setService]=useState('all'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const supportsRequest=p=>p.missions?.includes(initialMission)&&(initialMission!=='isr'||p.capabilities?.includes('isr'));
 const requested=packages.find(p=>p.ready&&supportsRequest(p)&&(!region||!packageOrder(g,'assignForcePackage',{package:p.id,region,posture:initialMission}).block))||packages.find(supportsRequest)||packages.find(p=>p.ready&&p.missions?.includes(initialMission));
 const [selectedId,setSelectedId]=useState(initialPackage||requested?.id||null),[destination,setDestination]=useState(region||''),[posture,setPosture]=useState(initialMission||'deter');
 const [assemblyOpen,setAssemblyOpen]=useState(false),[templateId,setTemplateId]=useState(''),[packageName,setPackageName]=useState(''),[replacementId,setReplacementId]=useState(''),[pending,setPending]=useState(null);
 const reviewRef=useRef(null);
 useClockHold(!!pending,'confirm');
 const matches=packages.filter(p=>(service==='all'||p.service===service)&&`${p.name} ${serviceName(g,p.service)} ${locationName(p)}`.toLowerCase().includes(query.trim().toLowerCase())&&(filter==='all'||filter==='assigned'&&!!p.region||filter==='ready'&&p.ready&&!p.region||filter==='attention'&&!p.ready));
 const selected=matches.find(p=>p.id===selectedId)||matches[0]||null;
 const templates=(v.templates||[]).filter(t=>service==='all'||t.service===service),template=templates.find(t=>t.id===templateId)||templates.find(t=>!t.block)||templates[0];
 const missions=selected?.missions?.length?selected.missions:Object.keys(POSTURE_LABELS);
 const chosenPosture=missions.includes(posture)?posture:missions[0]||'deter';
 const payload=selected?{package:selected.id,region:destination,posture:chosenPosture}:null;
 const assignment=selected?packageOrder(g,'assignForcePackage',payload):null;
 const recall=selected?packageOrder(g,'recallForcePackage',{package:selected.id}):null;
 const disband=selected?packageOrder(g,'disbandForcePackage',{package:selected.id}):null;
 const relief=packages.filter(p=>p.id!==selected?.id&&p.ready&&!p.region&&(p.template===selected?.template||p.service===selected?.service));
 const replacement=relief.find(p=>p.id===replacementId)||relief[0];
 const rotation=selected&&replacement?packageOrder(g,'rotateForcePackage',{package:selected.id,replacement:replacement.id}):null;
 const reinforcement=selected?packageOrder(g,'reinforceForcePackage',{package:selected.id}):null;
 const assembly=template?packageOrder(g,'assembleForcePackage',{template:template.id,...(packageName.trim()?{name:packageName.trim()}:{})}):null;
 const quoted=pending?packageOrder(g,pending.type,pending.payload):null;
 const ready=packages.filter(p=>p.ready&&!p.region).length,assigned=packages.filter(p=>p.region).length,attention=packages.filter(p=>!p.ready).length;
 const descriptor=services.find(s=>s.id===service);
 useEffect(()=>{if(region!==undefined)setDestination(region||'');},[region]);
 useEffect(()=>{if(initialPackage||initialMission){setSelectedId(initialPackage||requested?.id||null);setPosture(initialMission||'deter');setService('all');setQuery('');setFilter('all');}},[initialPackage,initialMission]);
 useEffect(()=>{if(selected){setPosture(selected.missions?.includes(initialMission)?initialMission:selected.posture||selected.missions?.[0]||'deter');if(!region)setDestination(selected.region||'');onPackage?.(selected.id);}setPending(null);},[selected?.id]);
 useEffect(()=>{
  if(!pending)return;
  const review=reviewRef.current;
  review?.focus?.({preventScroll:true});
  // Center the decisions themselves: the viewport includes fixed phone navigation,
  // so merely bringing the quote's outer edge into view can leave buttons covered.
  (review?.querySelector('[data-package-review-actions]')||review)?.scrollIntoView?.({block:'center',inline:'nearest'});
 },[pending]);
 const chooseDestination=value=>{setDestination(value);setPending(null);onRegion?.(value);};
 const review=(type,payload)=>setPending({type,payload});
 const commit=()=>{if(!pending||quoted?.block)return;dispatch({type:pending.type,payload:pending.payload});if(pending.type==='assembleForcePackage'&&quoted.package?.id){setSelectedId(quoted.package.id);setQuery('');setFilter('all');}setPending(null);};
 return <section className={`wl-package-desk${compact?' wl-package-compact':''}`} data-force-package-desk={compact?'compact':'full'}>
  <style>{FORCE_PACKAGE_CSS}</style>
  {!compact&&<header className="wl-package-header"><div><span className="wl-eyebrow">Service ownership · joint operations</span><h2>Force packages</h2><p>Choose a formation, assign its mission, and track the same force on the map.</p></div><button type="button" className="wl-btn" data-package-assemble-toggle aria-expanded={assemblyOpen} onClick={()=>setAssemblyOpen(!assemblyOpen)}>+ Assemble package</button></header>}
  {!compact&&<div className="wl-package-overview"><div><b>{ready}</b><span>Available at home</span></div><div><b>{assigned}</b><span>Assigned</span></div><div data-tone={attention?'warn':undefined}><b>{attention}</b><span>Need attention</span></div></div>}
  {!compact&&<div className="wl-package-toolbar">
   <label><span>Service</span><select data-package-service aria-label="Military service" value={service} onChange={e=>{setService(e.target.value);setPending(null);}}><option value="all">All services</option>{services.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
   {!compact&&<><label className="wl-package-search"><span>Find a formation</span><input aria-label="Find a force package" placeholder="Name, service or theater" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span>Status</span><select aria-label="Package status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All packages</option><option value="ready">Available at home</option><option value="assigned">Assigned</option><option value="attention">Needs attention</option></select></label></>}
  </div>}
  <div className="wl-package-layout">
   <div className="wl-package-roster">
    {compact?matches.length>0&&<label className="wl-package-field"><span className={region?'wl-package-destination':undefined} data-package-destination={region||undefined}>{region?<>Package to <b>{REGIONS[region]?.n}</b></>:'Operational package'}</span><select data-package-select aria-label="Operational force package" value={selected?.id||''} onChange={e=>setSelectedId(e.target.value)}>{services.map(s=><optgroup key={s.id} label={s.name}>{matches.filter(p=>p.service===s.id).map(p=><option value={p.id} key={p.id}>{p.name} · {status(p)}</option>)}</optgroup>)}</select></label>:<><div className="wl-package-list-label">{matches.length} formations</div><div className="wl-package-list">{matches.map(p=><button type="button" key={p.id} className="wl-package-card" data-force-package-card={p.id} aria-pressed={p.id===selected?.id} onClick={()=>setSelectedId(p.id)}><div><strong>{p.name}</strong><span className="wl-package-status" data-status={p.ready?'ready':'limited'}>{status(p)}</span></div><small>{serviceName(g,p.service)}</small><span className="wl-package-location">{locationName(p)}{p.region?` · ${missionName(p.posture)}`:''}</span></button>)}</div></>}
    {!matches.length&&<div className="wl-package-empty"><b>No matching packages</b><p>{descriptor?.note||'Change the filters or assemble a formation from available equipment.'}</p>{descriptor?.coverage==='not-modeled'&&<p>No inventory has been invented for this service.</p>}</div>}
   </div>
   {selected&&<article className="wl-package-inspector" data-package-inspector={selected.id}>
    {!compact&&<header><span className="wl-eyebrow">{serviceName(g,selected.service)}</span><h3>{selected.name}</h3><p>{locationName(selected)}{selected.region?` · ${missionName(selected.posture)}`:''}</p></header>}
    {!compact&&<PackageReadiness p={selected}/>}
    {selected.block&&selected.block!==assignment?.block&&<p className="wl-package-warning" data-package-readiness-block>{selected.block}</p>}
    <div className="wl-package-orders">
     {(!compact||!region)&&<label className="wl-package-field"><span>Destination theater</span><select data-package-destination aria-label="Package destination" value={destination} onChange={e=>chooseDestination(e.target.value)}><option value="">Choose a theater…</option>{Object.entries(REGIONS).map(([id,r])=><option key={id} value={id}>{r.n}</option>)}</select></label>}
     <label className="wl-package-field"><span>Package mission</span><select data-package-mission aria-label="Package mission" value={chosenPosture} onChange={e=>{setPosture(e.target.value);setPending(null);}}>{missions.map(id=><option key={id} value={id}>{missionName(id)}</option>)}</select></label>
     <button type="button" className="wl-btn wl-btn-primary wl-package-primary" data-package-review="assignForcePackage" disabled={!!assignment?.block} title={assignment?.block||'Review the full package order'} onClick={()=>review('assignForcePackage',payload)}>{selected.region?'Review mission & destination':'Review deployment'}</button>
     {assignment?.block&&<p className="wl-package-warning" data-package-block role="status">{assignment.block}</p>}
     {selected.region&&<button type="button" className="wl-btn" data-package-review="recallForcePackage" disabled={!!recall?.block} title={recall?.block||'Return the package to the available force'} onClick={()=>review('recallForcePackage',{package:selected.id})}>Review recall</button>}
    </div>
    {compact&&<><PackageReadiness p={selected}/>{selected.region&&<p className="wl-package-note">Currently assigned: {locationName(selected)}</p>}</>}
    {quoted&&pending.type!=='assembleForcePackage'&&<OrderReview order={quoted} reviewRef={reviewRef} onCancel={()=>setPending(null)} onConfirm={commit}/>}
    {selected.missionEffects?.length>0&&<div data-package-effects>{selected.missionEffects.map((line,i)=><p className="wl-package-note" key={i}>{line}</p>)}</div>}
    <PackageComposition p={selected} g={g}/>
    <div className="wl-package-shortcuts">{onJump&&<><button type="button" data-package-map disabled={!destination&&!selected.region} onClick={()=>onJump({tab:'overview',mode:'military',region:destination||selected.region,package:selected.id,mission:chosenPosture})}>Inspect theater on map ↗</button><button type="button" data-package-training onClick={()=>onJump({tab:'forces',sub:'training',package:selected.id,region:destination||selected.region,mission:chosenPosture})}>Crews & training ↗</button><button type="button" data-package-maintenance onClick={()=>onJump({tab:'forces',sub:'equipment',package:selected.id,region:destination||selected.region,mission:chosenPosture})}>Maintenance & equipment ↗</button><button type="button" data-package-procurement onClick={()=>onJump({tab:'arsenal',sub:'procurement',package:selected.id,region:destination||selected.region,mission:chosenPosture})}>Procurement ↗</button></>}</div>
    <details className="wl-package-management" data-package-management><summary>Reinforce, rotate & manage</summary>
     {selected.region&&<div className="wl-package-rotation"><label className="wl-package-field"><span>Relief formation</span><select aria-label="Relief package" data-package-replacement disabled={!relief.length} value={replacement?.id||''} onChange={e=>{setReplacementId(e.target.value);setPending(null);}}>{!relief.length&&<option value="">No ready replacement at home</option>}{relief.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" className="wl-btn" data-package-review="rotateForcePackage" disabled={!rotation||!!rotation.block} title={rotation?.block||'Swap formations in one order; retain the mission'} onClick={()=>review('rotateForcePackage',{package:selected.id,replacement:replacement.id})}>Review rotation</button>{rotation?.block&&<p className="wl-package-note">{rotation.block}</p>}</div>}
     <button type="button" className="wl-btn" data-package-review="reinforceForcePackage" disabled={!!reinforcement?.block} title={reinforcement?.block||'Restore missing components from available equipment'} onClick={()=>review('reinforceForcePackage',{package:selected.id})}>Review reinforcement</button>{reinforcement?.block&&<p className="wl-package-note">{reinforcement.block}</p>}
     <p className="wl-package-note">Disbanding returns the components to their services. It does not retire equipment.</p><button type="button" className="wl-btn" data-package-review="disbandForcePackage" disabled={!!disband?.block} title={disband?.block||'Return every component to the available inventory'} onClick={()=>review('disbandForcePackage',{package:selected.id})}>Review disbanding</button>{disband?.block&&<p className="wl-package-note">{disband.block}</p>}</details>
   </article>}
  </div>
  <details className="wl-package-assembly" open={assemblyOpen} onToggle={e=>setAssemblyOpen(e.currentTarget.open)} data-package-assembly><summary>Assemble from available equipment</summary>
   {template?<><label className="wl-package-field"><span>Formation template</span><select aria-label="Package template" data-package-template value={template.id} onChange={e=>{setTemplateId(e.target.value);setPending(null);}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p className="wl-package-note">{template.description}</p><p className="wl-package-note" data-package-assembly-available><b>{template.available||0}{template.available>=99?'+':''}</b> complete assemblies available from current inventory.</p><label className="wl-package-field"><span>Package name · optional</span><input aria-label="New package name" maxLength={80} value={packageName} onChange={e=>setPackageName(e.target.value)} placeholder={template.name}/></label><button type="button" className="wl-btn" data-package-review="assembleForcePackage" disabled={!!assembly?.block} onClick={()=>review('assembleForcePackage',{template:template.id,...(packageName.trim()?{name:packageName.trim()}:{})})}>Review assembly</button>{assembly?.block&&<p className="wl-package-warning" data-package-assembly-block>{assembly.block}</p>}{quoted&&pending.type==='assembleForcePackage'&&<OrderReview order={quoted} reviewRef={reviewRef} onCancel={()=>setPending(null)} onConfirm={commit}/>}</>:<p className="wl-package-note">No formation templates for this service's current inventory.</p>}
  </details>
  {compact&&onJump&&<button type="button" className="wl-btn wl-package-all" onClick={()=>onJump({tab:'forces',sub:'deployments',region:region||destination,package:selected?.id,mission:chosenPosture})}>All services & force packages ↗</button>}
 </section>;
}
