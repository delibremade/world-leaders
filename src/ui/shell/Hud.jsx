// Top bar (v2 §4): identity and date; resource wells with tooltip tables sourced from engine categories (treasury:
// ledger; stability: active effects; hegemony: the four pillars); colour-coded alert chips that focus the matching
// outliner rows and switch the map mode; pause that remembers its speed; speed pips; Next month. Reads props;
// dispatches nothing. The DOM contract (data-hud, data-speed, data-pause, data-step, data-why, data-bell) is what
// the layout, opened-state and shell tests drive.
import { LineChart, Line } from 'recharts';
import { Why } from './Why.jsx';
import { Icon } from './Icon.jsx';
import { COLOR } from '../tokens.js';
import { MONTHS, SC, ss } from '../../data/stats.js';
import { groupEffects, clockLabel } from './effects.js';

// FIX 1: the nation vitals live in the HUD tooltip tables at desktop (docs/DESIGN-SYSTEM-V2.md §4), not in a side column.
const vital = (stats, k) => { const c = SC[k]; const v = stats?.[k]; if (c == null || v == null) return null; const st = ss(k, v); return { key: k, label: c.label, text: c.fmt(v), color: st === 'critical' ? COLOR.accent.alert : st === 'warning' ? COLOR.accent.warn : COLOR.text.primary }; };
const vitals = (stats, keys) => keys.map((k) => vital(stats, k)).filter(Boolean);

export function Spark({ data, k, color, w = 52, h = 20 }) {
  if (!data || data.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  return (
    <LineChart width={w} height={h} data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
      <Line type="monotone" dataKey={k} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

const money = (v) => `$${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'B' : Math.round(Math.abs(v)) + 'M'}`;

export function Hud({ version, country, date, stats, ledger = {}, history = [], hegScore = 0, pillars = {}, activeEffects = [], hegHold = 0, pauseReason, paused, onPause, onTogglePause, pauseLocked, gameSpeed, onSpeed, lastSaved, onQuit, doctrineLabel, unread = 0, onFeed, canStep = false, onStep, alerts = [], onAlert, alertFocus = null, onAllocate }) {
  const net = Object.values(ledger).reduce((s, v) => s + v, 0);
  const income = Object.values(ledger).filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const spend = Object.values(ledger).filter((v) => v < 0).reduce((s, v) => s + v, 0);
  const stabTerms = groupEffects(activeEffects.filter((e) => e.stat === 'stability')).map((x) => ({ key: x.key, label: `${x.label}${x.count > 1 ? ` ×${x.count}` : ''} (${clockLabel(x)})`, value: x.d })); // FIX 4: one line per source, named
  const stabNet = stabTerms.reduce((s, t) => s + t.value, 0);
  const hegTerms = [['Economic', pillars.e], ['Military', pillars.m], ['Influence', pillars.i], ['Technology', pillars.t]].map(([l, v]) => ({ key: l.toLowerCase(), label: `${l} pillar ÷4`, value: (v || 0) / 4 }));
  const stab = stats?.stability || 0;
  const stabColor = stab < 40 ? COLOR.accent.alert : stab < 60 ? COLOR.accent.warn : COLOR.accent.good;
  const speeds = [[0, '⏸', 'Pause (Space)'], [1, '1×', 'Normal speed (- / = to change)'], [2, '2×', 'Double speed (- / = to change)'], [4, '4×', 'Quadruple speed (- / = to change)']];
  return (
    <header className="wl-hud" data-hud>
      <div className="wl-hud-row">
        <div className="wl-hud-nation">
          <span style={{ fontSize: 22 }} aria-hidden="true">{country?.flag}</span>
          <div style={{ minWidth: 0 }}><b>{country?.name}</b><small>{MONTHS[date.mo]} {date.yr} · v{version}{doctrineLabel ? ` · ${doctrineLabel}` : ''}{lastSaved ? ` · 💾 ${lastSaved}` : ''}</small></div>
        </div>
        {pauseReason && <span className="wl-pause-chip" data-pause-reason data-kind={pauseReason.kind}>⏸ {pauseReason.label}{pauseReason.kind === 'you' ? ` · tap ▶ or Space to resume at ${gameSpeed}×` : pauseReason.soft ? ` · tap ⏸ to close and resume at ${gameSpeed}×` : pauseReason.kind === 'ui' ? ` · close it to resume at ${gameSpeed}×` : ''}</span>}
        {alerts.length > 0 && <div className="wl-alerts" data-alerts role="group" aria-label="Alerts">
          {alerts.map((a) => (
            <button key={a.id} type="button" className="wl-alert-chip" data-alert-chip={a.family} data-urgent={a.urgent || undefined} aria-pressed={alertFocus === a.family} title={`${a.title} · focus in the outliner, map to ${a.mode}`} onClick={() => onAlert?.(a)}>
              <span aria-hidden="true">{a.icon}</span><span className="wl-num">{a.count}</span><span className="wl-alert-l">{a.label}</span>
            </button>))}
        </div>}
        <div className="wl-speed wl-pips" role="group" aria-label="Game speed" data-speed>
          {speeds.map(([v, l, t]) => v === 0
            ? <button key={v} type="button" title={paused ? `Resume at ${gameSpeed}× (Space)` : t} data-pause data-resume-speed={gameSpeed} aria-pressed={!!paused} aria-disabled={pauseLocked || undefined} onClick={() => onTogglePause()}>{paused ? `▶ ${gameSpeed}×` : l}</button>
            : <button key={v} type="button" title={t} data-pip={v} aria-pressed={!paused && gameSpeed === v} onClick={() => (onPause(false), onSpeed(v))}>{l}</button>)}
          {onStep && <button type="button" data-step title={canStep ? 'Next month (.)' : 'Pause to step one month (.)'} aria-label="Next month" aria-disabled={!canStep || undefined} onClick={() => canStep && onStep()}>⏭</button>}
        </div>
        {onAllocate && <button type="button" className="wl-btn wl-btn-sm" data-allocate title="Allocate: the five sector lines as one pool (drawer over the map)" onClick={onAllocate} aria-label="Allocate"><span aria-hidden="true">⚖</span><span className="wl-allocate-l">ALLOCATE</span></button>}
        {onFeed && <button type="button" className="wl-bell" data-bell data-unread={unread} title="Notifications" aria-label={`Notifications, ${unread} unread`} onClick={onFeed}><Icon name="bell"/>{unread > 0 && <span className="wl-bell-b" data-bell-badge>{unread > 99 ? '99+' : unread}</span>}</button>}
        <button type="button" className="wl-btn wl-btn-sm" title="New nation" aria-label="Quit to nation select" onClick={onQuit} style={{ minWidth: 36 }}>✕</button>
      </div>
      {stats && <div className="wl-hud-figs" data-wells>
        <Why title="Treasury: this month's ledger" facts={vitals(stats, ['gdpGrowth', 'debtGdp', 'military'])} subtitle={`Income ${money(income)} · spending ${money(spend)} · net ${net >= 0 ? '+' : '−'}${money(net)} per month`} terms={Object.entries(ledger).map(([k, v]) => ({ key: k, label: k, value: v }))} total={net} totalLabel="Net / month" fmt={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'B' : Math.round(v) + 'M'}`} note="Engine ledger categories (cash). Updated each month." data-well="treasury">
          <Spark data={history} k="treasury" color={COLOR.accent.good} />
          <div><div className="wl-fig-l">Treasury</div><div className="wl-fig-v" style={{ color: stats.treasury < 0 ? COLOR.accent.alert : COLOR.text.primary }}>{SC.treasury.fmt(stats.treasury)}<span className="wl-fig-d" style={{ color: net >= 0 ? COLOR.accent.good : COLOR.accent.alert }}>{net >= 0 ? '▲' : '▼'}{Math.abs(Math.round(net))}</span></div></div>
        </Why>
        <Why title="Stability: active effects" facts={vitals(stats, ['healthcare', 'education', 'foodSecurity', 'inequality', 'unemployment', 'inflation'])} subtitle={`${Math.round(stab)}/100 · ${stabTerms.length} active effect${stabTerms.length === 1 ? '' : 's'} · ${stabNet >= 0 ? '+' : '−'}${Math.abs(stabNet).toFixed(2)} per month`} terms={stabTerms} total={stabNet} totalLabel="Per month" fmt={(v) => v.toFixed(2)} note="Policy and event effects the engine applies to stability each month. Base drift from unemployment, inflation and inequality is not itemised by the engine yet." data-well="stability">
          <Spark data={history} k="stability" color={stabColor} />
          <div><div className="wl-fig-l">Stability</div><div className="wl-fig-v" style={{ color: stabColor }}>{Math.round(stab)}<span className="wl-fig-d" style={{ color: COLOR.text.dim }}>/100</span></div></div>
        </Why>
        <Why title="Hegemony: four pillars" subtitle={`${hegScore.toFixed(1)}% · hold 85% for 24 months${hegHold > 0 ? ` · ${hegHold}/24 held` : ''}`} terms={hegTerms} total={hegScore} totalLabel="Score" fmt={(v) => v.toFixed(1)} note="Hold 85% for 24 months to win the era." data-well="hegemony">
          <Spark data={history} k="heg" color={COLOR.accent.energy} />
          <div><div className="wl-fig-l">Hegemony</div><div className="wl-fig-v" style={{ color: hegScore >= 60 ? COLOR.accent.good : COLOR.text.primary }}>👑 {hegScore.toFixed(0)}%</div></div>
        </Why>
      </div>}
    </header>
  );
}
