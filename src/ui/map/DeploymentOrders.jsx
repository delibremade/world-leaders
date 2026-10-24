import {useState} from 'react';
import {REGIONS,POSTURE_LABELS} from '../../data/regions.js';
import {deploymentOptions} from '../../sim/deployment-view.js';
import {DeploymentPicker} from './DeploymentPicker.jsx';

// One order form for a map selection, base, or the national force workspace.
// Destinations are theaters: facilities provide reach, not individual unit slots.
export function DeploymentOrders({g,region,initialUnit,dispatch,onJump,chooseRegion=false,onRegion,onUnit}){
 const [chosen,setChosen]=useState(region||'');
 const rid=chooseRegion?chosen:region;
 const units=deploymentOptions(g,rid),here=units.reduce((n,u)=>n+u.here,0);
 return <section className="wl-deployment-orders" data-deployment-orders={rid||'unselected'}>
  {chooseRegion?<label className="wl-map-posture">Destination theater<select aria-label="Deployment theater" value={rid} onChange={e=>{setChosen(e.target.value);onRegion?.(e.target.value);}}><option value="">Choose destination…</option>{Object.entries(REGIONS).map(([id,r])=><option key={id} value={id}>{r.n}</option>)}</select></label>:<div className="wl-map-eyebrow">DEPLOY & RECALL · {REGIONS[rid]?.n}</div>}
  {!rid?<p className="wl-map-muted">Choose where to send your forces. Existing starting forces and purchased packages use the same orders.</p>:<>
   <DeploymentPicker key={initialUnit||'all'} units={units} region={rid} initialUnit={initialUnit} onUnit={onUnit} dispatch={dispatch} onJump={onJump}/>
   <label className="wl-map-posture">Mission posture<select aria-label="Mission posture" value={g.forcePosture?.[rid]||'deter'} disabled={!here} onChange={e=>dispatch({type:'setPosture',payload:{region:rid,posture:e.target.value}})}>{Object.entries(POSTURE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <p className="wl-map-muted">{here} packages assigned · ${here*4}M/month basing. Orders apply across {REGIONS[rid]?.n}, not to an individual base. Posture applies to every package here.</p>
  </>}
  {onJump&&<div className="wl-map-shortcuts"><button data-deployment-training onClick={()=>onJump({tab:'forces',sub:'training'})}>Crews & training →</button><button onClick={()=>onJump({tab:'arsenal',sub:'procurement'})}>Acquire platforms →</button></div>}
 </section>;
}
