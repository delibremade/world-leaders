import {NATIONS} from './nations.js';

// Responsibility labels for the game's existing intelligence systems. These do not grant
// personnel, collection systems, operating authorities or a separate agency budget.
// References: intelligence.gov/how-the-ic-works; mod.go.jp/dih/about/mission.html;
// bnd.bund.de (The German Foreign Intelligence Service); eos-utvalget.no/en/home/about-the-eos-committee/the-eos-services/.
const A=(id,short,name,role,disciplines)=>({id,short,name,role,disciplines});
const OWNERS={
 usa:[
  A('cia','CIA','Central Intelligence Agency','Foreign human intelligence and covert-program coordination',['foreign','human','covert']),
  A('nsa','NSA','National Security Agency','Signals intelligence and cryptanalysis',['signals']),
  A('nro','NRO','National Reconnaissance Office','National reconnaissance collection systems',['collection']),
  A('nga','NGA','National Geospatial-Intelligence Agency','Imagery and geospatial analysis',['imagery']),
  A('dia','DIA','Defense Intelligence Agency','Military assessment and all-source support',['military','fusion']),
  A('fbi','FBI','Federal Bureau of Investigation','Domestic counterintelligence',['domestic']),
 ],
 germany:[A('bnd','BND','Federal Intelligence Service','Foreign intelligence, collection and analysis',['foreign','human','covert','signals','collection','imagery','military','fusion']),A('bfv','BfV','Federal Office for the Protection of the Constitution','Domestic intelligence and counterintelligence',['domestic'])],
 japan:[A('ciro','CIRO','Cabinet Intelligence and Research Office','National intelligence coordination',['foreign','human','covert']),A('dih','DIH','Defense Intelligence Headquarters','Military, signals and imagery assessment',['signals','collection','imagery','military','fusion']),A('psia','PSIA','Public Security Intelligence Agency','Domestic security intelligence',['domestic'])],
 norway:[A('nis','NIS','Norwegian Intelligence Service','Foreign and military intelligence',['foreign','human','covert','signals','collection','imagery','military','fusion']),A('pst','PST','Police Security Service','Domestic intelligence and counterintelligence',['domestic'])],
 russia:[A('svr','SVR','Foreign Intelligence Service','Foreign intelligence',['foreign','human','covert']),A('military','Military intelligence','Military intelligence','Military collection and assessment',['signals','collection','imagery','military','fusion']),A('fsb','FSB','Federal Security Service','Domestic security and counterintelligence',['domestic'])],
 china:[A('mss','MSS','Ministry of State Security','Civilian intelligence and counterintelligence',['foreign','human','covert','domestic']),A('military','PLA intelligence','Military intelligence','Military collection and assessment',['signals','collection','imagery','military','fusion'])],
 brazil:[A('abin','ABIN','Brazilian Intelligence Agency','National intelligence and counterintelligence',['foreign','human','covert','domestic']),A('defense','Defense intelligence','Defense intelligence','Military collection and assessment',['signals','collection','imagery','military','fusion'])],
 cuba:[A('di','DI','Directorate of Intelligence','Foreign intelligence',['foreign','human','covert']),A('domestic','Counterintelligence','Domestic counterintelligence','National protection',['domestic']),A('defense','Military intelligence','Military intelligence','Military collection and assessment',['signals','collection','imagery','military','fusion'])],
};
export const intelligenceServices=nid=>NATIONS[nid]?(OWNERS[nid]||[]).map(a=>({...a,nation:nid})):[];
export const intelligenceService=(nid,discipline)=>intelligenceServices(nid).find(a=>a.disciplines.includes(discipline))||null;
export const intelServiceFor=(nid,opId)=>intelligenceService(nid,opId==='counter_int'?'domestic':'foreign');
const INFRA_DISCIPLINE={listening_posts:'signals',crypt_center:'signals',overseas_stations:'human',paramilitary:'covert',isr_fusion:'fusion'};
export const infrastructureService=(nid,id)=>intelligenceService(nid,INFRA_DISCIPLINE[id]||'fusion');
