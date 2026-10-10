// HUD bar (P3c): nation + date, speed control (pause/1x/2x/4x), pause-reason chip (a pause always shows why),
// and three figures with 24-month sparklines and why-breakdowns: treasury + monthly net (ledger categories),
// stability (active effects by stat), hegemony (the four pillars). Reads props; dispatches nothing.
import { LineChart, Line } from 'recharts';
import { Why } from './Why.jsx';
import { COLOR } from '../tokens.js';
import { MONTHS, SC } from '../../data/stats.js';

export function Spark({ data, k, color, w = 52, h = 20 }) {
  if (!data || data.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  return (
    <LineChart width={w} height={h} data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
      <Line type="monotone" dataKey={k} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

export function Hud({ version, country, date, stats, ledger = {}, history = [], hegScore = 0, pillars = {}, activeEffects = [], pauseReason, paused, onPause, onTogglePause, pauseLocked, gameSpeed, onSpeed, lastSaved, onQuit, doctrineLabel }) {
  const net = Object.values(ledger).reduce((s, v) => s + v, 0);
  const stabTerms = activeEffects.filter((e) => e.stat === 'stability').map((e) => ({ key: e.id, label: `${e.name || e.policyName || e.id} (${e.monthsLeft}mo)`, value: e.d }));
  const stabNet = stabTerms.reduce((s, t) => s + t.value, 0);
  const hegTerms = [['Economic', pillars.e], ['Military', pillars.m], ['Influence', pillars.i], ['Technology', pillars.t]].map(([l, v]) => ({ label: `${l} pillar ÷4`, value: (v || 0) / 4 }));
  const stabColor = (stats?.stability || 0) < 40 ? COLOR.accent.alert : (stats?.stability || 0) < 60 ? COLOR.accent.warn : COLOR.accent.good;
  const speeds = [[0, '⏸', 'Pause'], [1, '1×', 'Normal speed'], [2, '2×', 'Double speed'], [4, '4×', 'Quadruple speed']];
  return (
    <header className="wl-hud" data-hud>
      <div className="wl-hud-row">
        <div className="wl-hud-nation">
          <span style={{ fontSize: 22 }} aria-hidden="true">{country?.flag}</span>
          <div style={{ minWidth: 0 }}><b>{country?.name}</b><small>{MONTHS[date.mo]} {date.yr} · v{version}{doctrineLabel ? ` · ${doctrineLabel}` : ''}{lastSaved ? ` · 💾 ${lastSaved}` : ''}</small></div>
        </div>
        {pauseReason && <span className="wl-pause-chip" data-pause-reason data-kind={pauseReason.kind}>⏸ {pauseReason.label}{pauseReason.kind === 'you' ? ` · tap ▶ or Space to resume at ${gameSpeed}×` : pauseReason.soft ? ` · tap ⏸ to close and resume at ${gameSpeed}×` : ''}</span>}
        <div className="wl-speed" role="group" aria-label="Game speed" data-speed>
          {speeds.map(([v, l, t]) => v === 0
            ? <button key={v} type="button" title={paused ? `Resume at ${gameSpeed}×` : t} data-pause data-resume-speed={gameSpeed} aria-pressed={!!paused} aria-disabled={pauseLocked || undefined} onClick={() => onTogglePause()}>{paused ? `▶ ${gameSpeed}×` : l}</button>
            : <button key={v} type="button" title={t} aria-pressed={!paused && gameSpeed === v} onClick={() => (onPause(false), onSpeed(v))}>{l}</button>)}
        </div>
        <button type="button" className="wl-btn wl-btn-sm" title="New nation" aria-label="Quit to nation select" onClick={onQuit} style={{ minWidth: 36 }}>✕</button>
      </div>
      {stats && <div className="wl-hud-figs">
        <Why title="Treasury: this month's ledger" terms={Object.entries(ledger).map(([k, v]) => ({ key: k, label: k, value: v }))} total={net} totalLabel="Net / month" fmt={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'B' : Math.round(v) + 'M'}`} note="Engine ledger categories (cash). Updated each month.">
          <Spark data={history} k="treasury" color={COLOR.accent.good} />
          <div><div className="wl-fig-l">Treasury</div><div className="wl-fig-v" style={{ color: stats.treasury < 0 ? COLOR.accent.alert : COLOR.text.primary }}>{SC.treasury.fmt(stats.treasury)}<span className="wl-fig-d" style={{ color: net >= 0 ? COLOR.accent.good : COLOR.accent.alert }}>{net >= 0 ? '▲' : '▼'}{Math.abs(Math.round(net))}</span></div></div>
        </Why>
        <Why title="Stability: active effects" terms={stabTerms} total={stabNet} totalLabel="Per month" fmt={(v) => v.toFixed(2)} note="Policy and event effects the engine applies to stability each month. Base drift from unemployment, inflation and inequality is not itemised by the engine yet.">
          <Spark data={history} k="stability" color={stabColor} />
          <div><div className="wl-fig-l">Stability</div><div className="wl-fig-v" style={{ color: stabColor }}>{Math.round(stats.stability)}<span className="wl-fig-d" style={{ color: COLOR.text.dim }}>/100</span></div></div>
        </Why>
        <Why title="Hegemony: four pillars" terms={hegTerms} total={hegScore} totalLabel="Score" fmt={(v) => v.toFixed(1)} note="Hold 85% for 24 months to win the era.">
          <Spark data={history} k="heg" color={COLOR.accent.energy} />
          <div><div className="wl-fig-l">Hegemony</div><div className="wl-fig-v" style={{ color: hegScore >= 60 ? COLOR.accent.good : COLOR.text.primary }}>👑 {hegScore.toFixed(0)}%</div></div>
        </Why>
      </div>}
    </header>
  );
}
