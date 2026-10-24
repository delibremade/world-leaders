import { useState } from 'react';
import { Panel, Row } from '../shell/Panel.jsx';
import { DataTable } from '../shell/DataTable.jsx';
import { MINERAL_RULES as R } from '../../data/minerals.js';
import { NATIONS } from '../../data/nations.js';
const qty=n=>n.toLocaleString('en-US',{maximumFractionDigits:1});
export function TradeDesk({rows,v,dispatch,onOpenNation,initialMineral}){
  const [mineral,setMineral]=useState(initialMineral||rows[0]?.id),[supplier,setSupplier]=useState(null),[search,setSearch]=useState('');
  const r=rows.find(x=>x.id===mineral)||rows[0];
  const partners=r.partners.filter(p=>p.n.toLowerCase().includes(search.toLowerCase()));
  const p=partners.find(x=>x.id===supplier)||partners.find(x=>!x.reason)||partners[0];
  const deals=rows.flatMap(x=>x.deals.map(d=>({...d,r:x}))),pact=v.minerals?.pact;
  const bloc=NATIONS[v.country?.id]?.bloc,canPact=bloc==='west'||bloc==='east';
  const cols=[
    {id:'n',label:'Supplier',get:p=>p.n},
    {id:'units',label:`${r.unit} /mo`,num:true,get:p=>p.units*r.tPerUnit,cell:p=>qty(p.units*r.tPerUnit)},
    {id:'price',label:'$M /mo',num:true,get:p=>p.price},
    {id:'status',label:'Access',get:p=>p.reason?'Restricted':'Open',tone:p=>p.reason?'warn':'good'},
  ];
  return <div className="wl-trade-desk" data-master-detail="deals">
    <div className="wl-trade-compare">
      <Panel id="trade-supply" title="Strategic supply desk" figure={`${deals.length} contracts`}>
        <label className="wl-field">Compare mineral<select className="wl-sel" aria-label="Compare mineral" value={r.id} onChange={e=>{setMineral(e.target.value);setSupplier(null);}}>{rows.map(x=><option key={x.id} value={x.id}>{x.n}</option>)}</select></label>
        <div className="wl-trade-metrics"><div><b>{qty(r.stockT)}</b><small>{r.unit} in stock</small></div><div><b>{qty(r.flow.secure*r.tPerUnit)}</b><small>{r.unit}/mo secure supply</small></div><div><b>{qty(r.queuedT)}</b><small>{r.unit} owed to production</small></div></div>
        <p className="wl-note">{r.n}: {qty(r.inflowT)} {r.unit}/mo total inflow. Secure supply includes home processing, recycling, contracts and the allied pact. Open-market supply can be interrupted.</p>
        <label className="wl-field">Find supplier<input aria-label="Find mineral supplier" placeholder="Nation name…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      </Panel>
      <DataTable id="partners" label="Available partners" title={`${r.n} suppliers`} columns={cols} rows={partners} rowId={p=>p.id} selected={p?.id} onSelect={setSupplier}/>
      {!partners.length&&<p className="wl-note">No matching uncontracted processors. Try another mineral or supplier.</p>}
      <Panel id="deals" title="Active contracts" figure={`$${deals.filter(d=>!d.paused).reduce((s,d)=>s+d.price,0)}M/mo`}>
        {!deals.length&&<p className="wl-note">Select a supplier to secure a {R.offtake.term}-month offtake contract.</p>}
        {deals.map(d=><Row key={`${d.m}_${d.n}`} data-deal={`${d.m}_${d.n}`} title={`${d.r.n} · ${d.name}`} sub={`${qty(d.units*d.r.tPerUnit)} ${d.r.unit}/mo · ${d.mo} months left${d.paused?' · export control: supply paused':''}`} value={`$${d.price}M/mo`} tone={d.paused?'alert':undefined} trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={()=>dispatch({type:'cancelOfftake',payload:{mineral:d.m,nation:d.n}})}>Cancel</button>}/>) }
      </Panel>
    </div>
    <div data-detail="deals">
      {p&&<Panel id="supplier" title="Contract assessment" figure={p.n} tone={p.reason?'warn':'good'}>
        <h3>{r.i} {r.n} from {p.n}</h3>
        <Row title="Additional secure supply" value={`${qty(p.units*r.tPerUnit)} ${r.unit}/mo`}/>
        <Row title="Fixed monthly price" value={`$${p.price}M`}/>
        <Row title="Term" value={`${R.offtake.term} months`}/>
        <Row title="Total scheduled payments" value={`$${(p.price*R.offtake.term).toLocaleString('en-US')}M`}/>
        <Row title="Relations" value={Math.round(p.relation)} tone={p.relation>=0?'good':'warn'}/>
        <p className="wl-note">Contracts lock the quoted price. Supplier export controls can pause deliveries; relations alone do not guarantee uninterrupted supply.</p>
        {p.reason&&<p data-trade-reason className="wl-reason">{p.reason}</p>}
        <button type="button" className="wl-btn wl-btn-primary" data-sign-offtake={`${r.id}_${p.id}`} disabled={!!p.reason} onClick={()=>dispatch({type:'signOfftake',payload:{mineral:r.id,nation:p.id}})}>Sign offtake · ${p.price}M/mo</button>
        {onOpenNation&&<button type="button" className="wl-btn" style={{marginTop:8}} onClick={()=>onOpenNation(p.id)}>Open {p.n} diplomacy ↗</button>}
      </Panel>}
      {canPact&&<Panel id="pact" title="Allied processing pact" figure={pact?'Active':'Available'}>
        <p className="wl-note">Bloc partners prioritize your supply and do not impose export controls against you while the pact is active.</p>
        <button type="button" className="wl-btn" aria-pressed={!!pact} onClick={()=>dispatch({type:'toggleProcessingPact',payload:{}})}>{pact?'End pact':`Activate pact · $${R.pact.cost}M/mo`}</button>
      </Panel>}
    </div>
  </div>;
}
