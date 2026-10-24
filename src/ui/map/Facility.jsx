import { symbolPath } from './symbols.js';
export function Facility({type='naval',large=false}) {
  return <svg className={large?'wl-facility wl-facility-large':'wl-facility'} viewBox={large?'-40 -32 80 64':'-16 -16 32 32'} aria-hidden="true">
    {large&&<><path d="M-36 13 0-8 36 13 0 32Z" fill="#163744" stroke="#346473"/><path d="M-36 13 0 32 36 13 36 18 0 37 -36 18Z" fill="#081923"/></>}
    {large&&<path d={symbolPath(type)} transform="translate(2 5)" fill="#050e18" opacity=".7"/>}
    <path d={symbolPath(type)} fill="currentColor" stroke={large?'#c1f4e3':'none'} strokeWidth=".6"/>
    {type==='logistics'&&<path d="M-6 9V-1H6V9M0-1V9" fill="none" stroke="#163744" strokeWidth="2"/>}
  </svg>;
}
