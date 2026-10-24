import { useEffect, useId, useRef } from 'react';
import { useClockHold } from './ClockGate.jsx';

// Native top-layer dialog: the activity rail cannot cover it, and background controls are inert.
// Doctrine already has an engine clock gate; ordinary card reading uses the existing sheet hold.
export function DecisionDialog({ title, eyebrow, required = false, onClose, children, className = '' }) {
  const ref = useRef(null), heading = useId();
  useClockHold(!required, 'sheet');
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', ''); // jsdom has no dialog implementation
    dialog.querySelector('[data-dialog-title]')?.focus();
    return () => { if (typeof dialog.close === 'function') dialog.close(); if (previous?.isConnected) previous.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`wl-decision-dialog ${className}`} data-decision-dialog role="dialog" aria-modal="true" aria-labelledby={heading}
    onCancel={e => { e.preventDefault(); if (!required) onClose(); }} onKeyDown={e => {
      e.stopPropagation();
      if (e.key !== 'Tab') return;
      const controls = [...e.currentTarget.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length);
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!first) { e.preventDefault(); e.currentTarget.querySelector('[data-dialog-title]')?.focus(); }
      else if (e.shiftKey && (active === first || !controls.includes(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }}>
    <header className="wl-decision-head">
      <div>{eyebrow && <span className="wl-eyebrow">{eyebrow}</span>}<h2 id={heading} tabIndex={-1} data-dialog-title>{title}</h2></div>
      {!required && <button className="wl-btn" type="button" data-decision-close aria-label="Close decision" onClick={onClose}>✕</button>}
    </header>
    <div className="wl-decision-body">{children}</div>
  </dialog>;
}

export const DECISION_CSS = `
.wl-decision-dialog{box-sizing:border-box;width:min(920px,calc(100vw - 40px));max-width:none;max-height:calc(100dvh - 40px);padding:0;border:1px solid #40566d;border-radius:12px;background:#0c1825;color:#dbe8f3;box-shadow:0 24px 90px #000b;overflow:auto;font:inherit}
.wl-decision-dialog::backdrop{background:#030a14c9}
.wl-decision-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 26px 12px;background:#0c1825}
.wl-decision-head h2{font-size:27px;line-height:1.2;margin:5px 0;color:#edf5ff;outline:none}
.wl-decision-head .wl-btn{min-width:44px;min-height:44px}
.wl-decision-body{padding:0 26px 22px;min-width:0}
.wl-doctrine-intro{font-size:14px;color:#9aafc2;line-height:1.5;margin:0 0 18px}
.wl-doctrine-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
button.wl-doctrine-option{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:16px 18px;margin:0;border:1px solid #354b60;border-top:3px solid var(--doctrine);border-radius:8px;background:#122335;color:#d5e2ed;text-align:left;font:inherit;cursor:pointer;min-width:0}
.wl-doctrine-option:hover{background:#193248;border-color:var(--doctrine)}
.wl-doctrine-option:focus-visible{outline:3px solid #e7f7ff;outline-offset:2px}
.wl-doctrine-title{display:flex;align-items:center;gap:10px}.wl-doctrine-title>span{font-size:25px}.wl-doctrine-title b{color:#eff7ff;font-size:18px;line-height:1.25;margin:0}
.wl-doctrine-option .wl-doctrine-summary{font-size:12px;color:#9db5c7;line-height:1.4}
.wl-doctrine-benefits{display:flex;flex-wrap:wrap;gap:5px 12px}.wl-doctrine-option .wl-doctrine-benefits span{font-size:12px;color:#91dcbb;line-height:1.5}
.wl-doctrine-cost{border-top:1px solid #2d4356;padding-top:8px;margin-top:auto;font-size:12px;color:#ecc690;line-height:1.4}
.wl-doctrine-cost span{color:#9db0c1;margin-right:6px}
.wl-doctrine-footer{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:18px;font-size:12px;color:#9db0c1;line-height:1.5}
.wl-doctrine-footer p{margin:0}.wl-doctrine-footer .wl-btn{min-height:44px}
.wl-card-review{display:block;width:100%;min-height:38px;margin:8px 0;border:1px solid #36566c;border-radius:5px;background:#142d40;color:#aadcf4;text-align:center;font:inherit;font-size:12px;cursor:pointer}
.wl-decision-dialog .wl-card-ev{margin:0;padding:18px;animation:none;min-width:0;width:100%}
.wl-decision-dialog .wl-card-ev h4{font-size:22px;line-height:1.3}.wl-decision-dialog .wl-card-ev p{font-size:14px;line-height:1.6}
.wl-decision-dialog .wl-opts{grid-template-columns:repeat(2,minmax(0,1fr))}.wl-decision-dialog .wl-opt{padding:15px;min-height:44px}.wl-decision-dialog .wl-opt small{font-size:12px;line-height:1.55}
@media(max-width:699px){.wl-decision-dialog{width:calc(100vw - 20px);max-height:calc(100dvh - 20px);border-radius:9px}.wl-decision-head{padding:18px 16px 10px}.wl-decision-head h2{font-size:23px}.wl-decision-body{padding:0 16px 18px}.wl-doctrine-grid,.wl-decision-dialog .wl-opts{grid-template-columns:minmax(0,1fr)}button.wl-doctrine-option{padding:14px}.wl-decision-dialog .wl-card-ev{padding:12px}}
`;
