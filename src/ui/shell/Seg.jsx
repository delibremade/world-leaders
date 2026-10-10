// Segmented control: folded verticals (Overview | Situation, Economy | Resources) and per-vertical sub-tabs.
// Every segment is a 44px tap target; segments share the row equally so five fit at 390px with no sideways scroll.
export function Seg({ items, active, onSelect, label, id }) {
  return (
    <div className="wl-seg" role="tablist" aria-label={label} data-segbar={id}>
      {items.map((s) => (
        <button key={s.id} type="button" role="tab" data-seg={s.id} aria-selected={active === s.id} onClick={() => onSelect(s.id)}>
          <span className="wl-seg-l">{s.label}</span>
          {s.badge > 0 && <span className="wl-seg-b" data-sev={s.sev || 'warn'}>{s.badge}</span>}
        </button>
      ))}
    </div>
  );
}
