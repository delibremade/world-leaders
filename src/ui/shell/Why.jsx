// "Why" breakdown (PLAYABLE-PLAN UI principle 2: every number explains itself). Radix popover over any figure.
// terms: [{label, value}] from engine categories (ledger, activeEffects, selectors.js); never recomputed here.
// value is signed and formatted by `fmt`; mult=true renders multiplicative terms (×1.4).
import * as Popover from '@radix-ui/react-popover';
import { COLOR } from '../tokens.js';

const fmtNum = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}B` : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));

export function Why({ title, terms = [], total, totalLabel = 'Net', fmt = fmtNum, mult = false, note, children, className = 'wl-fig', ...rest }) {
  const rows = terms.filter((t) => mult ? t.value !== 1 : t.value !== 0).sort((a, b) => Math.abs(mult ? Math.log(b.value) : b.value) - Math.abs(mult ? Math.log(a.value) : a.value));
  const sign = (v) => (mult ? (v > 1 ? COLOR.accent.good : v < 1 ? COLOR.accent.alert : COLOR.text.muted) : v > 0 ? COLOR.accent.good : v < 0 ? COLOR.accent.alert : COLOR.text.muted);
  const show = (v) => (mult ? `×${v.toFixed(2)}` : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`);
  return (
    <Popover.Root>
      <Popover.Trigger asChild><button type="button" className={className} data-why={title} {...rest}>{children}</button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="wl-why" sideOffset={6} collisionPadding={8} data-why-content={title}>
          <h5>{title}</h5>
          {rows.length === 0 && <div className="wl-why-row"><span style={{ color: COLOR.text.dim }}>No contributing terms this month</span></div>}
          {rows.map((t, i) => <div key={t.key || i} className="wl-why-row"><span>{t.label}</span><span style={{ color: sign(t.value) }}>{show(t.value)}</span></div>)}
          {total != null && <div className="wl-why-total"><span>{totalLabel}</span><span style={{ color: sign(total) }}>{mult ? `×${total.toFixed(2)}` : show(total)}</span></div>}
          {note && <div className="wl-why-note">{note}</div>}
          <Popover.Arrow className="wl-why-arrow" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
