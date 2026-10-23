// Screen-space presentation only. A cluster retains all ids; no nearby asset becomes unreachable.
export const visibleLayers = mode => ({
  sites: ['military','sphere','intel','energy','trade'].includes(mode),
  routes: ['trade','energy'].includes(mode),
  influence: ['sphere','intel'].includes(mode),
  chokepoints: ['trade','energy','military','tension'].includes(mode),
});
export function layoutSites(sites, { zoom=1, scale=1, tilt=1, build=false }={}) {
  const eligible=sites.filter(s=>s.selected||build||zoom>=1.6);
  const groups=[];
  for(const s of [...eligible].sort((a,b)=>Number(!!b.selected)-Number(!!a.selected))) {
    const near=groups.find(g=>Math.hypot((g.x-s.x)*scale,(g.y-s.y)*scale*tilt)<34);
    if(near){near.ids.push(s.id);near.mine+=s.mine||0;continue;}
    groups.push({...s,ids:[s.id]});
  }
  return groups;
}
