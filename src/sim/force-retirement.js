// One pure quote for equipment, domestic procurement and imported retirement.
// Execution must commit nextCount and nextForces together, then reconcile packages.
import {PLATFORMS} from '../data/platforms.js';
import {ORBAT} from '../data/orbat.js';
import {FLEET_PACKAGES} from '../data/deployment-catalog.js';
import {effectiveForces} from './forces.js';
import {inventoryLine,deploymentAvailabilityBase,linePhysicalInventory} from './force-inventory.js';
import {packageReservations} from './force-packages.js';

const count=n=>Number.isFinite(+n)?Math.max(0,Math.floor(+n)):0;
const reservationBlock='Reserved by force packages. Disband the reserving package; recall it first if deployed.';
function takeAt(at,n,home){
  const out={...at};let left=n;
  for(const id of [home,...Object.keys(out).filter(id=>id!==home)]){
    const take=Math.min(left,out[id]||0);left-=take;
    if(take){out[id]-=take;if(!out[id])delete out[id];}
  }
  return out;
}
export function retirementQuote(g,{platform,source='domestic',line,n=1}={}){
  const f=effectiveForces(g),reserved=packageReservations({...g,forces:f});
  const base={block:null,platform:platform||null,source:platform?source:'starting',line:line||null,count:n,platforms:0,available:0,owned:0,per:1};
  const reject=(block,extra={})=>({...base,...extra,block});
  if(!Number.isInteger(n)||n<1)return reject('Choose a positive whole retirement quantity');
  let target,nextCount,nextFielded,platforms,available,owned,per=1,nextGame=g;
  if(platform){
    if(!PLATFORMS[platform]||!['domestic','imported'].includes(source))return reject('Choose a valid domestic or imported platform');
    const key=source==='domestic'?'platforms':'platformsImported';
    owned=count(g[key]?.[platform]);
    const aggregate=count(g.platforms?.[platform])+count(g.platformsImported?.[platform])+count(g.blackPrograms?.[platform]);
    const x=deploymentAvailabilityBase(g,platform,f);per=x.per;target=inventoryLine(g,platform,f).line;
    available=Math.min(owned,Math.max(0,aggregate-(reserved[platform]||0)));
    if(n>owned)return reject('Not enough units in this procurement source',{owned,available,per,line:target?.id||null});
    if(n>available)return reject(reservationBlock,{owned,available,per,line:target?.id||null});
    nextCount=owned-n;nextFielded=aggregate-n;
    // Losses can leave historical batches in the manifest. Retiring those entries
    // must not strike a second set of aircraft/hulls from another surviving alias.
    platforms=Math.max(0,x.platforms-nextFielded*per);
    nextGame={...g,[key]:{...g[key],[platform]:nextCount}};
  }else{
    target=(ORBAT[f.nid]||[]).find(l=>l.id===line);
    if(!target||!f.fleet?.[target.id])return reject('Choose an existing force-inventory line');
    const starter=`fleet:${f.nid}:${target.id}`,stock=linePhysicalInventory(g,target,f);
    owned=stock.starting;per=1;
    if(!owned)return reject(`No ${target.n} starting stock left to retire. Purchased units retire through Procurement.`);
    const reservedPhysical=Math.min(owned,(reserved[starter]||0)*(FLEET_PACKAGES[starter]?.per||1));
    available=Math.max(0,owned-reservedPhysical);
    if(n>available)return reject(owned>available?reservationBlock:'Only surviving unreserved starting stock can be retired here. Retire purchased units through their domestic or imported inventory.',{owned,available});
    platforms=n;
  }
  let nextForces={...f};
  if(platform)nextForces.fielded={...f.fielded,[platform]:nextFielded};
  if(target){
    const current=f.fleet[target.id];
    nextForces.fleet={...f.fleet,[target.id]:{...current,n:Math.max(0,current.n-platforms),at:takeAt(current.at,platforms,g.country?.region)}};
  }
  nextGame={...nextGame,forces:nextForces};
  // Source claims can share one ORBAT line. Validate every reservation against
  // the resulting allocation, including packages kept at home and legacy saves.
  for(const [id,k]of Object.entries(reserved)){
    const before=deploymentAvailabilityBase(g,id,f),after=deploymentAvailabilityBase(nextGame,id,nextForces);
    if(after.platforms<Math.min(before.platforms,k*before.per))
      return reject(reservationBlock,{owned,available,per,line:target?.id||null});
  }
  return {...base,line:target?.id||null,owned,available,per,platforms,nextCount,nextFielded,nextForces};
}
