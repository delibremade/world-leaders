import {NATIONS} from './nations.js';
import {ORBAT,UNIT_PLATFORMS} from './orbat.js';
import {FLEET_PACKAGES} from './deployment-catalog.js';
import {PLATFORMS,BLACK_PROGRAMS} from './platforms.js';
import {SOF_ORBAT} from './sof.js';

// Ownership describes the institution. Domain describes where its equipment operates.
// These are country-keyed annotations of NATIONS and ORBAT, never another nation registry.
const SERVICE_TYPES={
  army:{name:'Army',short:'Army',icon:'▰',domains:['land','air']},
  navy:{name:'Navy',short:'Navy',icon:'⚓',domains:['sea','air']},
  air_force:{name:'Air Force',short:'Air Force',icon:'✈',domains:['air','land']},
  airborne:{name:'Airborne Forces',short:'Airborne',icon:'◇',domains:['land','air']},
  marines:{name:'Marine Corps',short:'Marines',icon:'▥',domains:['land','air']},
  space:{name:'Space support',short:'Space',icon:'◉',domains:['space']},
  coast_guard:{name:'Coast Guard',short:'Coast Guard',icon:'◇',domains:['sea','air']},
  joint:{name:'Joint / shared inventory',short:'Joint',icon:'⌘',domains:['land','air','sea','space','cyber']},
  strategic:{name:'Strategic forces',short:'Strategic',icon:'△',domains:['land']},
  security:{name:'Security service',short:'Security',icon:'◈',domains:['land','intelligence']},
};
export const SERVICE_IDS=Object.keys(SERVICE_TYPES);
const NAMES={
  usa:{army:'U.S. Army',navy:'U.S. Navy',air_force:'U.S. Air Force',marines:'U.S. Marine Corps',space:'U.S. Space Force',coast_guard:'U.S. Coast Guard',joint:'Joint / shared inventory'},
  germany:{army:'Heer',navy:'Deutsche Marine',air_force:'Luftwaffe',joint:'Joint / shared inventory'},
  japan:{army:'Ground Self-Defense Force',navy:'Maritime Self-Defense Force',air_force:'Air Self-Defense Force',joint:'Joint / shared inventory'},
  norway:{army:'Norwegian Army',navy:'Royal Norwegian Navy',air_force:'Royal Norwegian Air Force',joint:'Joint / shared inventory'},
  brazil:{army:'Brazilian Army',navy:'Brazilian Navy',air_force:'Brazilian Air Force',joint:'Joint / shared inventory'},
  cuba:{army:'Revolutionary Army',navy:'Revolutionary Navy',air_force:'Air and Air Defense Force',joint:'Joint / shared inventory'},
  russia:{army:'Ground Forces',navy:'Navy',air_force:'Aerospace Forces',airborne:'Airborne Forces (VDV)',strategic:'Strategic Missile Forces',security:'FSB',joint:'Joint / shared inventory'},
  china:{army:'PLA Ground Force',navy:'PLA Navy',air_force:'PLA Air Force',strategic:'PLA Rocket Force',joint:'Joint / shared inventory'},
};
const LINE_OWNERS={
  usa:{f35b:'marines',f35c:'joint',fa18ef:'navy',ea18g:'navy',faxx:'navy',p8:'navy',usmc_inf_bn:'marines',mm3:'air_force'},
  russia:{su30:'joint',mr_bde:'joint',icbm:'strategic'},
  china:{j35:'joint',icbm:'strategic'},
  germany:{p8:'navy'},
  japan:{p1:'navy'},
};
const MIXED_NOTES={
  usa:{f35c:'Navy / Marine aircraft remain one shared inventory; the service split is not modeled.'},
  russia:{su30:'Aerospace Forces / naval aviation remain one shared inventory; the service split is not modeled.',mr_bde:'Motor-rifle / airborne formations remain one shared inventory; the service split is not modeled.'},
  china:{j35:'Land and carrier variants remain one shared program; the variant split is not modeled. Carrier qualification is not assumed.'},
};
const SOF_OWNERS={
  usa:{cag:'army',devgru:'navy',sts24:'air_force',rangers:'army',sf:'army',seals:'navy',marsoc:'marines'},
  russia:{ksso:'joint',alpha:'security',spetsnaz:'army',vdv45:'airborne'},
  germany:{ksk:'army',ksm:'navy',fsj:'army'},
  japan:{sfgp:'army',sbu:'navy',abn1:'army'},
  norway:{fsk:'army',mjk:'navy',telemark:'army'},
  cuba:{avispas:'joint'},
};
const lineOf=(nid,line)=>typeof line==='string'?(ORBAT[nid]||[]).find(l=>l.id===line):line;
export function lineService(nid,line){
  const l=lineOf(nid,line);if(!l)return 'joint';
  return LINE_OWNERS[nid]?.[l.id]||(l.b==='sea'?'navy':l.b==='air'?'air_force':'army');
}
export const sofService=(nid,id)=>SOF_OWNERS[nid]?.[id]||'joint';
export function sofCommand(nid,id){
  if(nid==='usa')return ['cag','devgru','sts24'].includes(id)?'USSOCOM / JSOC':'USSOCOM';
  if(nid==='russia'&&id==='alpha')return 'FSB';
  return 'Joint tasking';
}
export function serviceMeta(nid,id){
  if(!NATIONS[nid]||!SERVICE_TYPES[id])return null;
  const base=SERVICE_TYPES[id],name=NAMES[nid]?.[id]||base.name;
  const modeled=(ORBAT[nid]||[]).some(l=>l.count>0&&lineService(nid,l)===id)||(SOF_ORBAT[nid]||[]).some(u=>u.ops>0&&sofService(nid,u.id)===id);
  const coverage=id==='joint'?'shared':modeled?'modeled':id==='space'?'support':'not-modeled';
  const note=id==='joint'?'Shared inventory or joint tasking preserves each component’s owner; no duplicate equipment is created.'
    :id==='space'?'Separate spacecraft inventory is not modeled. Existing national space and reconnaissance programs remain in Technology and Intelligence.'
    :id==='coast_guard'?'Coast Guard hulls and aircraft are not represented in the current inventory. No patrol units are created from Navy stock.'
    :!modeled?'No operational units for this service are represented in the current inventory.'
    :'Service ownership is separate from mission command and operating domain.';
  return {...base,id,name,coverage,note};
}
export const serviceLabel=(nid,id)=>serviceMeta(nid,id)?.name||'Joint / shared inventory';
export function servicesFor(nid){
  if(!NATIONS[nid]?.play)return [];
  const ids=new Set(Object.keys(NAMES[nid]||{army:1,navy:1,air_force:1,joint:1}));
  for(const l of ORBAT[nid]||[])ids.add(lineService(nid,l));
  for(const u of SOF_ORBAT[nid]||[])ids.add(sofService(nid,u.id));
  return SERVICE_IDS.filter(id=>ids.has(id)).map(id=>serviceMeta(nid,id));
}

// Program ownership is explicit when the game already names a naval or shared design.
// This annotates identities; it never moves platforms between fleet lines or changes procurement.
export function unitProfile(nid,id){
  const pkg=FLEET_PACKAGES[id];
  const l=pkg?.nid===nid?lineOf(nid,pkg.line):(ORBAT[nid]||[]).find(x=>x.buys?.includes(id));
  const p=PLATFORMS[id]||BLACK_PROGRAMS[id];
  const slotRole={gen5:'fighter',gen6:'fighter',bomber:'bomber',cca:'drone',isr:'isr',ssn:'ssn',carrier:'carrier'};
  const role=l?.role||UNIT_PLATFORMS[id]?.role||slotRole[p?.slot]||({satellite_net:'space',cyber_command:'cyber',missile_brigade:'missile',hypersonic_bty:'missile'}[id])||'support';
  let service=l?lineService(nid,l):['carrier','ssn','ssgn','ssk','ssbn','destroyer','cruiser','frigate','corvette','amphib'].includes(role)?'navy'
    :['fighter','attack','bomber','tanker','awacs','airlift','isr','drone'].includes(role)?'air_force'
    :role==='space'?(nid==='usa'?'space':'joint'):role==='cyber'?'joint':'army';
  if(['fa_xx','mq25'].includes(id))service='navy';
  if(nid==='china'&&['missile_brigade','hypersonic_bty'].includes(id))service='strategic';
  if(id==='j35')service='joint';
  const domain=l?.cls==='airframe'?'air':l?.b||(['carrier','ssn','ssgn','ssk','ssbn','destroyer','cruiser','frigate','corvette','amphib'].includes(role)?'sea':['fighter','attack','bomber','tanker','awacs','airlift','isr','drone'].includes(role)?'air':['space','cyber'].includes(role)?role:'land');
  const carrierAir=(nid==='usa'&&['fa18ef','f35c','faxx','ea18g'].includes(l?.id))||['fa_xx','mq25'].includes(id);
  const stovl=(nid==='usa'&&l?.id==='f35b')||(nid==='japan'&&l?.id==='f35b');
  const carrierType=role!=='carrier'?null:['ford','fujian','x_carrier'].includes(id)?'catapult':nid==='usa'&&l?.id==='cvn'?'catapult':['ddh','pha'].includes(l?.id)?'helicopter':'ski_jump';
  return {id,service,domain,role,line:l?.id||null,carrierAir,stovl,carrierType,note:MIXED_NOTES[nid]?.[l?.id]||(id==='j35'?MIXED_NOTES.china.j35:'')};
}
export const unitService=(nid,id)=>unitProfile(nid,id).service;
