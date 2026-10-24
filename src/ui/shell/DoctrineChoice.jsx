import { DOCTRINES } from '../../data/world.js';
import { DecisionDialog } from './DecisionDialog.jsx';

export function DoctrineChoice({ country, dispatch, onBack }) {
  return <DecisionDialog required title="Choose your national doctrine" eyebrow={`${country?.name || 'Your nation'} · Campaign setup`} className="wl-doctrine-dialog">
    <div data-event-card="doctrine" data-modal="1900">
      <p className="wl-doctrine-intro">Choose the advantages and tradeoff you want to govern with. Time is paused.</p>
      <div className="wl-doctrine-grid">
        {Object.entries(DOCTRINES).map(([id, d]) => <button key={id} type="button" className="wl-opt wl-doctrine-option" data-doctrine={id} style={{ '--doctrine': d.col }} onClick={() => dispatch({ type: 'chooseDoctrine', payload: { doctrine: id } })}>
          <span className="wl-doctrine-title"><span aria-hidden="true">{d.i}</span><b>{d.n}</b></span>
          <span className="wl-doctrine-summary">{d.d.split('.')[0]}.</span>
          <span className="wl-doctrine-benefits">{d.pros.map(p => <span key={p}>{p}</span>)}</span>
          <span className="wl-doctrine-cost"><span>Tradeoff</span>{d.cons.join(' · ')}</span>
        </button>)}
      </div>
    </div>
    <footer className="wl-doctrine-footer"><p>All four victory paths remain available.<br/>Hegemony: hold 85% for 24 months.</p>{onBack && <button type="button" className="wl-btn" data-doctrine-back onClick={onBack}>Change nation</button>}</footer>
  </DecisionDialog>;
}
