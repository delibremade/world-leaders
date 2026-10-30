import { useEffect, useState } from 'react';
import { REGIONS } from '../../data/regions.js';
// Both the desktop inspector and the phone theater sheet expose the same complete inventory.
export function DeploymentPicker({units,region,dispatch,initialUnit,onJump,onUnit}){
 const [unitId,setUnitId]=useState(initialUnit||null),selected=units.find(o=>o.id===unitId)||units[0];
 useEffect(()=>{if(selected)onUnit?.(selected.id);},[selected?.id,onUnit]);
 if(!selected)return <p className="wl-map-muted">No deployable equipment. Review procurement and readiness in Forces.</p>;
 return <div data-deployment-picker>
  <label className="wl-map-posture">Choose individual equipment<select aria-label="Force package" value={selected.id} onChange={e=>setUnitId(e.target.value)}>{units.map(o=><option key={o.id} value={o.id}>{o.name} · {o.free} available</option>)}</select></label>
  <div className="wl-deployment-buttons"><button className="wl-map-primary" aria-label={`Station ${selected.name}`} disabled={!!selected.reason} title={selected.reason||`Station in ${REGIONS[region].n}`} data-map-deploy={selected.id} onClick={()=>dispatch({type:'adjustDeployment',payload:{region,unit:selected.id,delta:1}})}>Deploy 1 · $4M/mo</button><button className="wl-map-secondary" aria-label={`Recall ${selected.name}`} disabled={!(selected.recallable??selected.here)} title={selected.recallReason||'Return this individual detachment home'} data-map-recall={selected.id} onClick={()=>dispatch({type:'adjustDeployment',payload:{region,unit:selected.id,delta:-1}})}>Recall 1</button></div>
  {selected.reason&&<p className="wl-map-gate" data-deployment-block>{selected.reason}</p>}
  {selected.here&&selected.recallReason&&<p className="wl-map-gate" data-recall-block>{selected.recallReason}</p>}
  <div className="wl-deployment-stock"><b>{selected.name}</b><small>{selected.owned} owned · {selected.here} here · {selected.free} available · {selected.source}</small></div>
  {!selected.free&&onJump&&<button className="wl-map-secondary" data-find-assignments onClick={()=>onJump({tab:'forces',sub:'deployments',unit:selected.id})}>Find this force’s assignments →</button>}
  {units.filter(o=>o.here&&o.id!==selected.id).map(o=><button type="button" className="wl-map-secondary" key={o.id} onClick={()=>setUnitId(o.id)}>{o.name} · {o.here} stationed →</button>)}
 </div>;
}
