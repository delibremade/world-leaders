// Nuclear register rows: who fired, at whom, when. One render for the Situation panel and Arsenal > Deterrence.
import { Row } from './Panel.jsx';
import { NATIONS } from '../../data/nations.js';
import { REGIONS } from '../../data/regions.js';
import { MONTHS } from '../../data/stats.js';

const L = { demonstration: '☢ Demonstration strike', employment: '☢️ Tactical employment', ultimatum: '⚠ Nuclear ultimatum', exchange: '💀 Exchange' };

export function NukeRegister({ log, me }) {
  if (!log.length) return <div className="wl-note">No nuclear-tier events. The register records demonstrations, employments, ultimatums, and exchanges — yours and theirs.</div>;
  return <div data-nuke-register>{log.map((e, i) => (
    <Row key={i} title={`${NATIONS[e.actor]?.n || e.actor} → ${NATIONS[e.target]?.n || e.target}${e.region ? ` · ${REGIONS[e.region]?.n}` : ''}`}
      sub={L[e.type] || e.type} value={`${MONTHS[e.mo]} ${e.yr}`} tone={e.actor === me ? 'warn' : 'alert'} />))}</div>;
}
