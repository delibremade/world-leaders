import {DecisionDialog} from '../shell/DecisionDialog.jsx';
import {INTEL_OPS} from '../../data/intel.js';
import {NATIONS} from '../../data/nations.js';
import {SC} from '../../data/stats.js';
import {intelOrder} from '../../sim/intel-operations.js';
// Describe applied response effects. Old narrative tags claimed several mechanics the engine does not implement.
export function crisisLines(g,crisis,response){
 const lines=Object.entries(response.effect||{}).filter(([k,v])=>k in g.stats&&typeof v==='number').map(([k,v])=>`${SC[k]?.label||k}: ${v>0?'+':'−'}${k==='treasury'?`$${Math.abs(v)}M`:Math.abs(v)}`);
 if(response.sphereEffect)lines.push(`Your influence ${response.sphereEffect.delta} in ${response.sphereEffect.regions||1} regions.`);
 if(response.id==='absorb')lines.push('+15 percentage points of success on your next two intelligence orders (95% cap).');
 if(response.id==='retaliate'){const q=intelOrder(g,'destab',crisis.targetId);lines.push(`Launch a ${q.op.mo}-month destabilization operation for $${q.cost}M. ${q.effect} Discovery risk: ${Math.round(q.odds.discoverRate*100)}%.`);}
 return lines;
}
export function IntelCrisis({g,crisis,dispatch}){
 const title=crisis.type==='friendly'?'Operation discovered by an ally':crisis.type==='stolen'?'Foreign operation detected':'Operation discovered by an adversary';
 return <DecisionDialog title={title} eyebrow="Intelligence Crisis · response required" required modalPriority={1500}>
  <div data-intel-crisis>
   <p className="wl-doctrine-intro">{NATIONS[crisis.targetId]?.n||crisis.targetId} · {INTEL_OPS.find(o=>o.id===crisis.opId)?.n||crisis.opId}. Review the consequences, then choose a response.</p>
   <div className="wl-doctrine-grid">{crisis.responses.map(r=>{const blocked=r.id==='retaliate'?intelOrder(g,'destab',crisis.targetId).block:null;return <button key={r.id} type="button" className="wl-doctrine-option" style={{'--doctrine':'#e9a783'}} data-intel-response={r.id} disabled={!!blocked} onClick={()=>dispatch({type:'respondIntelCrisis',payload:{response:r.id,crisis}})}><b className="wl-doctrine-title">{r.label}</b>{crisisLines(g,crisis,r).map((line,i)=><span className="wl-doctrine-summary" key={i}>{line}</span>)}{blocked&&<span>{blocked}</span>}</button>;})}</div>
  </div>
 </DecisionDialog>;
}
