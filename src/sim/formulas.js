// One implementation per formula (CLAUDE.md rule 8). Pure: plain data in, number/bool out.
import { NATION_BLOC } from '../data/nations.js';
import { DEP_W } from '../data/platforms.js';

// Units deployed in one region, unweighted.
export const sumDep=o=>Object.values(o||{}).reduce((a,b)=>a+(b||0),0);
// Bloc partner (never yourself, never a neutral).
export const isAllyOf=(pid,cid)=>cid!==pid&&NATION_BLOC[cid]&&NATION_BLOC[cid]!=='neutral'&&NATION_BLOC[cid]===NATION_BLOC[pid];
// Strongest non-allied competitor entry [id, share] in a region's competitors map.
export const topHostile=(comps,pid)=>Object.entries(comps||{}).filter(([cid])=>!isAllyOf(pid,cid)).sort((a,b)=>b[1]-a[1])[0];
// Deployment weight in one region (DEP_W per platform, default 1).
export const wSum=o=>Object.entries(o||{}).reduce((a,[k,v])=>a+(v||0)*(DEP_W[k]||1),0);
// ISR score: satellites x2, RQ-170 x2, RQ-180 x4, Space R&D level, ISR fusion cell +4, SR-72 +6, drone swarms x1.
// Was duplicated at 8 sites in v57 (4 tick/handler sites on refs, 4 render sites on state).
export const isrScore=(platforms,levels,infra,black)=>(platforms.satellite_net||0)*2+(platforms.rq170||0)*2+(platforms.rq180||0)*4+(levels.space||0)+(infra.isr_fusion?4:0)+(black?.sr72?6:0)+(platforms.drone_swarm||0);
// Naval weight of the forces stationed in one region: carriers + subs + SSN(X) x2 + frigates x0.5 + Zumwalts x1.2.
// Was duplicated at 7 sites in v57.
export const navalWeight=o=>{o=o||{};return (o.carrier_group||0)+(o.sub_fleet||0)+(o.ssnx||0)*2+(o.frigate||0)*0.5+(o.zumwalt||0)*1.2;};
