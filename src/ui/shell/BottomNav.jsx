// Bottom nav (phone) / side rail (desktop, via CSS): the nine verticals with pending-decision badges.
// Phone: nine icon-only buttons share the row, the active one also shows its label; every vertical is one tap away.
export function BottomNav({ tabs, active, onSelect }) {
  return (
    <nav className="wl-nav" aria-label="Verticals" data-nav>
      {tabs.map((t) => (
        <button key={t.id} type="button" data-tab={t.id} aria-label={t.label} aria-current={active === t.id ? 'page' : undefined} onClick={() => onSelect(t.id)} title={t.label}>
          <span aria-hidden="true">{t.icon}</span><span className="wl-nav-l">{t.short || t.label}</span>
          {t.badge > 0 && <span className="wl-badge" data-sev={t.sev || 'warn'} data-badge={t.id}>{t.badge}</span>}
        </button>
      ))}
    </nav>
  );
}
