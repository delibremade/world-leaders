// One readable register in both Situation and Arsenal; rows grow to fit full names and dates.
import { NATIONS } from '../../data/nations.js';
import { REGIONS } from '../../data/regions.js';
import { MONTHS } from '../../data/stats.js';
const L = { demonstration: '☢ Demonstration strike', employment: '☢ Tactical employment', ultimatum: '⚠ Nuclear ultimatum', exchange: '☢ Exchange' };
export function NukeRegister({log,me}){
 return <div data-nuke-register className="wl-nuclear-list">{!log.length?<p className="wl-note">No nuclear-tier events. This register records who acted, the target, region, and date.</p>:log.map((e,i)=><article key={i} className="wl-nuclear-entry" data-nuke-entry data-tone={e.actor===me?'warn':'alert'}>
  <header><b>{L[e.type]||e.type}</b><time>{MONTHS[e.mo]} {e.yr}</time></header>
  <p>{NATIONS[e.actor]?.n||e.actor} → {NATIONS[e.target]?.n||e.target}</p>
  {e.region&&<small>Region: {REGIONS[e.region]?.n||e.region}</small>}
 </article>)}</div>;
}
