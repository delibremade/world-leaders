import { useState } from 'react';
import { REGIONS } from '../../data/regions.js';
// Both the desktop inspector and the phone theater sheet expose the same complete inventory.
export function DeploymentPicker({units,region,dispatch}){
 const [unitId,setUnitId]=useState(null),selected=units.find(o=>o.id===unitId)||units[0];
 if(!selected)return <p className="wl-map-muted">No deployable force packages. Review procurement and readiness in Forces.</p>;
 return <div data-deployment-picker>
  <label className="wl-map-posture">Choose force package<select aria-label="Force package" value={selected.id} onChange={e=>setUnitId(e.target.value)}>{units.map(o=><option key={o.id} value={o.id}>{o.name} · {o.free} available</option>)}</select></label>
  <div className="wl-map-unit"><div><b>{selected.name}</b><small>{selected.here} here · {selected.free} available · {selected.source}</small>{selected.free>0&&selected.reason&&<small>{selected.reason}</small>}</div><button aria-label={`Recall ${selected.name}`} disabled={!selected.here} data-map-recall={selected.id} onClick={()=>dispatch({type:'adjustDeployment',payload:{region,unit:selected.id,delta:-1}})}>−</button><button aria-label={`Station ${selected.name}`} disabled={!!selected.reason} title={selected.reason||`Station in ${REGIONS[region].n}`} data-map-deploy={selected.id} onClick={()=>dispatch({type:'adjustDeployment',payload:{region,unit:selected.id,delta:1}})}>+</button></div>
  {units.filter(o=>o.here&&o.id!==selected.id).map(o=><button type="button" className="wl-map-secondary" key={o.id} onClick={()=>setUnitId(o.id)}>{o.name} · {o.here} stationed →</button>)}
 </div>;
}
