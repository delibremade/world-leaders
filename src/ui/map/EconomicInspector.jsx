import {useEffect,useState} from 'react';
import {ECONOMIC_HUBS,ECONOMIC_SECTORS,economicHubs} from '../../data/economic-hubs.js';
import {economicSectorView} from '../../sim/economic-view.js';
import {Allocation} from '../economy/Allocation.jsx';
import {SOCIAL_PROGRAMS} from '../../data/economy.js';

export function EconomicInspector({g,selection,sector,onSector,onSelect,onClose,onJump,dispatch,allocation}){
  const [query,setQuery]=useState('');
  const hub=selection?.kind==='hub'?ECONOMIC_HUBS[selection.id]:null;
  useEffect(()=>{if(selection?.kind==='hub')setQuery('');},[selection?.kind,selection?.id]);
  const current=hub?(hub.sectors.includes(sector)?sector:hub.sectors[0]):sector==='all'?null:sector;
  const v=current?economicSectorView(g,current):null;
  const hubs=economicHubs(g.country.id,sector).filter(h=>(selection?.kind!=='hubCluster'||selection.ids.includes(h.id))&&`${h.name} ${h.role}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <aside className="wl-operations wl-economic-inspector" data-economic-inspector aria-label="Civilian economy">
    {!hub&&<label className="wl-map-search"><span>FIND AN ECONOMIC HUB</span><input aria-label="Find a city or economic activity" placeholder="City, industry, food, services…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
    <div className="wl-operations-scroll">
      <div className="wl-operations-head"><div><span className="wl-map-eyebrow">CIVILIAN ECONOMY</span><h3>{hub?.name||g.country.name}</h3></div>{selection&&<button className="wl-map-close" aria-label="Clear city selection" onClick={onClose}>×</button>}</div>
      {hub&&!query?<>
        <div className="wl-economic-tags" role="group" aria-label="City economic sectors">{hub.sectors.map(k=><button key={k} data-hub-sector={k} aria-pressed={k===current} onClick={()=>onSector(k)} style={{'--sector-color':ECONOMIC_SECTORS[k].color}}>{ECONOMIC_SECTORS[k].icon} {ECONOMIC_SECTORS[k].name}</button>)}</div>
      </>:null}
      {!query&&<>
        <p className="wl-economic-scope" data-economy-scope>National controls · shared across hubs.</p>
        {v?<section data-economic-sector={current}>
          <div className="wl-economic-actions">{v.routes.map(r=><button key={r.label} className="wl-map-secondary" data-economy-route={r.jump.sub||r.jump.tab} onClick={()=>onJump(r.jump)}>{r.label} ↗</button>)}</div>
          {current==='food'&&<button className="wl-map-secondary" data-economic-food aria-pressed={!!g.socialPrograms?.has('food_assistance')} onClick={()=>dispatch({type:'toggleSocialProgram',payload:{program:'food_assistance'}})}>{g.socialPrograms?.has('food_assistance')?'End':'Enable'} food assistance · {g.socialPrograms?.has('food_assistance')?'save ':''}${SOCIAL_PROGRAMS.food_assistance.cost}M/mo</button>}
          {!!v.budgets.length&&allocation&&<details className="wl-economic-budget" open><summary>National funding · {v.name}</summary><Allocation {...allocation} compact visibleSectors={v.budgets.map(b=>b.sector)} allocs={g.budgetAlloc} maturity={g.sectorMaturity} treasury={g.stats.treasury} dispatch={dispatch}/><button className="wl-map-secondary" data-economy-budget onClick={()=>onJump({tab:'economy',sector:v.budgets[0].sector})}>Full budget & all allocations ↗</button></details>}
          <div className="wl-map-facts">{v.metrics.map(m=><div key={m.label}><b>{m.value}</b><span>{m.label}</span></div>)}</div>
        </section>:<div className="wl-map-facts"><div><b>{g.stats.gdpGrowth.toFixed(1)}%</b><span>National GDP growth</span></div><div><b>{g.stats.unemployment.toFixed(1)}%</b><span>National unemployment</span></div></div>}
      </>}
      {(!hub||query)&&<div data-economic-hub-list><span className="wl-map-eyebrow">{hubs.length} {sector==='all'?'CIVILIAN':ECONOMIC_SECTORS[sector].name.toUpperCase()} HUBS{selection?.kind==='hubCluster'?' IN THIS AREA':''}</span>
        {hubs.map(h=><button key={h.id} className="wl-map-row" data-locate-hub={h.id} onClick={()=>{setQuery('');onSelect({kind:'hub',id:h.id});}}><span className="wl-city-glyph" aria-hidden="true">▥</span><span><b>{h.name}</b><small>{h.role}</small></span><span>›</span></button>)}
        {!hubs.length&&<p className="wl-map-muted">No matching hubs in this sector. Choose All sectors to broaden the search.</p>}
      </div>}
      <details className="wl-economic-explainer"><summary>Economic role & scope</summary>{hub&&<p>{hub.role}</p>}<p>National controls apply to the whole country. City production and jobs are not yet modeled.</p></details>
      {hub&&!query&&<button className="wl-map-secondary" data-economy-all-hubs onClick={()=>{onSector('all');onClose();}}>Browse all economic hubs</button>}
    </div>
  </aside>;
}
