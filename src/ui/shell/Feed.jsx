// Notification feed (Q1, #41): every engine notice, newest first, in a sheet opened from the HUD bell. A row with a
// jump opens the right pane and sheet. "Routing" sets, per class, whether a notice toasts, only feeds, or pauses.
import { useState } from 'react';
import { Sheet } from './Sheet.jsx';
import { CLASSES, CLASS_IDS, ROUTES, FEED_CAP } from './feed.js';
import { MONTHS } from '../../data/stats.js';

const ROUTE_LABEL = { toast: 'Toast', feed: 'Feed', pause: 'Pause' };
const ROUTE_HINT = { toast: 'Pops up and is kept here', feed: 'Kept here only', pause: 'Stops the clock and is kept here' };

export function Feed({ open, onClose, entries, routes, onRoute, onJump }) {
  const [tab, setTab] = useState('feed');
  const unread = entries.reduce((n, e) => n + (e.read ? 0 : 1), 0);
  return (
    <Sheet open={open} onClose={onClose} title="Notifications" subtitle={`${entries.length} of ${FEED_CAP} kept · ${unread} unread`}>
      <div className="wl-seg" role="tablist" aria-label="Feed views" style={{ marginBottom: 8, padding: 0, background: 'transparent' }}>
        {[['feed', 'Feed'], ['routing', 'Routing']].map(([id, l]) => <button key={id} type="button" role="tab" data-feed-tab={id} aria-selected={tab === id} onClick={() => setTab(id)}><span className="wl-seg-l">{l}</span></button>)}
      </div>
      {tab === 'feed' && <div data-feed-list>
        {entries.length === 0 && <div className="wl-label" style={{ padding: '12px 0' }}>Nothing yet. Notices from the engine collect here.</div>}
        {entries.map((e) => {
          const c = CLASSES[e.cls];
          const body = <>
            <span aria-hidden="true" className="wl-feed-i">{c.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b>{e.text}</b><small>{MONTHS[e.date.mo]} {e.date.yr} · {c.label}{e.n > 1 ? ` · ×${e.n}` : ''}{e.jump ? ' · tap to open' : ''}</small></span>
            {!e.read && <span className="wl-feed-dot" aria-label="unread" />}
          </>;
          return e.jump
            ? <button key={e.id} type="button" className="wl-feed-row" data-feed-row={e.id} data-class={e.cls} data-sev={e.sev} data-read={e.read ? 'true' : 'false'} onClick={() => onJump(e.jump)}>{body}</button>
            : <div key={e.id} className="wl-feed-row" data-feed-row={e.id} data-class={e.cls} data-sev={e.sev} data-read={e.read ? 'true' : 'false'}>{body}</div>;
        })}
      </div>}
      {tab === 'routing' && <div data-feed-routing>
        <div className="wl-label" style={{ marginBottom: 6 }}>What each kind of notice does. Every notice is always kept in the feed.</div>
        {CLASS_IDS.map((id) => (
          <div key={id} className="wl-route" data-route-class={id}>
            <span className="wl-route-l"><span aria-hidden="true">{CLASSES[id].icon}</span> {CLASSES[id].label}</span>
            <span className="wl-route-seg" role="group" aria-label={`${CLASSES[id].label} routing`}>
              {ROUTES.filter((r) => !(r === 'pause' && CLASSES[id].noPause)).map((r) => <button key={r} type="button" data-route={r} title={ROUTE_HINT[r]} aria-pressed={routes[id] === r} onClick={() => onRoute(id, r)}>{ROUTE_LABEL[r]}</button>)}
            </span>
          </div>))}
      </div>}
    </Sheet>
  );
}
