// Shared figure helpers for vertical screens: tone thresholds and the inline why-popover trigger.
import { Why } from './Why.jsx';

export const f0 = (x) => x.toFixed(0);
export const f1 = (x) => x.toFixed(1);
export const f2 = (x) => x.toFixed(2);
export const tone = (v, lo, hi) => (v < lo ? 'alert' : v < hi ? 'warn' : 'good');
export const WhyV = ({ title, terms, total, children, ...rest }) => <Why title={title} terms={terms} total={total} className="wl-wy" fmt={(v) => v.toFixed(1)} {...rest}>{children}</Why>;
