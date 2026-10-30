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
// Move only the label, never its geographic anchor. A leader line connects any displaced callout.
export function layoutLabels(items,{width,height,obstacles=[]}) {
  const placed=[];
  for(const item of items){
    let found=null;
    for(const radius of [0,54,108,162,216]){
      const offsets=radius?[[0,-radius],[0,radius],[-radius,0],[radius,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]:[[0,0]];
      for(const [dx,dy]of offsets){const p={...item,x:item.x+dx,y:item.y+dy};
        if(p.x-p.w/2<12||p.x+p.w/2>width-12||p.y-p.h/2<48||p.y+p.h/2>height-80)continue;
        if([...placed,...obstacles].some(a=>Math.abs(a.x-p.x)<(a.w+p.w)/2+4&&Math.abs(a.y-p.y)<(a.h+p.h)/2+4))continue;
        found=p;break;
      }if(found)break;
    }
    if(found)placed.push(found);
  }
  return placed;
}
