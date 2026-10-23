// Operational atlas: real geography on a flat world plane; shallow relief at regional zoom.
// All symbols and text keep their screen size. Simulation state enters through scene.js only.
import { REGION_GEO } from '../../data/regions.js';
import { parseRegions, regionAt, WORLD } from './path.js';
import { COLOR, FONT, pixiHex } from '../tokens.js';
import { lodFor, layersAt } from './lod.js';
import { layoutSites, layoutLabels, visibleLayers } from './layout.js';
import { SYMBOLS } from './symbols.js';
export const TILT = 0.84;
const parsed = parseRegions(REGION_GEO);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export async function createPixiMap(container, {onTap,onSiteTap,onChokeTap,onClusterTap,onViewChange}={}) {
  const [{Application,Container,Graphics,Text},{Viewport}]=await Promise.all([import('pixi.js'),import('pixi-viewport')]);
  const app=new Application(); const dpr=Math.min(devicePixelRatio||1,3);
  await app.init({resizeTo:container,background:0x081923,antialias:true,autoDensity:true,resolution:dpr,preference:'webgl'});
  container.appendChild(app.canvas);app.canvas.style.display='block';app.canvas.style.touchAction='none';
  const sw=()=>container.clientWidth||390,sh=()=>container.clientHeight||300;
  const viewport=new Viewport({screenWidth:sw(),screenHeight:sh(),worldWidth:WORLD.w,worldHeight:WORLD.h,events:app.renderer.events,passiveWheel:false,stopPropagation:true});
  app.stage.addChild(viewport);
  const fitScale=()=>Math.min(sw()/1080,Math.max(180,sh()-100)/560);
  const ratio=()=>viewport.scaled/fitScale();
  viewport.drag().pinch().wheel({smooth:4}).decelerate({friction:.9});
  const clamp=()=>{viewport.clampZoom({minScale:fitScale(),maxScale:Math.max(6,fitScale()*8)});viewport.clamp({direction:'all',underflow:'center'});};
  clamp();viewport.setZoom(fitScale(),true);viewport.moveCenter(500,260);
  const plane=viewport.addChild(new Container());
  const grid=plane.addChild(new Graphics()),walls=plane.addChild(new Graphics()),land=plane.addChild(new Container());
  const rings=plane.addChild(new Graphics()),lanes=plane.addChild(new Graphics());
  const overlay=viewport.addChild(new Container());
  const tops={};for(const id of Object.keys(parsed))tops[id]=land.addChild(new Graphics());
  let scene=null,tilt=1,level='strategic',hits=[],groups=[],phase=0,frames=0,fps=0,last=performance.now(),count=0;
  const textPool=[];let textIndex=0;
  const text=(parent,value,x,y,size=12,color=COLOR.text.secondary,weight='600')=>{
    const t=textPool[textIndex]||new Text({text:value,style:{fontFamily:FONT.sans,fontSize:size,fill:color,fontWeight:weight},resolution:Math.max(2,dpr),roundPixels:true});textPool[textIndex++]=t;parent.addChild(t);t.text=value;t.style.fontSize=size;t.style.fill=color;t.style.fontWeight=weight;
    t.anchor.set(.5);t.position.set(x,y);return t;
  };
  const pin=(x,y)=>{const c=overlay.addChild(new Container());c.position.set(x,y*tilt);c.scale.set(1/viewport.scaled);return c;};
  app.canvas.style.cursor='grab';
  const outline=(g,color,width=1,alpha=1)=>g.stroke({color:pixiHex(color),width,alpha});
  const pick=(kind,id,x,y,r=19,extra={})=>hits.push({kind,id,x,y:y*tilt,r,...extra});
  const drawLand=()=>{
    walls.clear();
    for(const r of scene.regions){const g=tops[r.rid];g.clear();
      if(tilt<.99){for(const p of parsed[r.rid].polys)walls.poly(p.flatMap(([x,y])=>[x,y+5/viewport.scaled]),true);walls.fill({color:0x030c13});}
      for(const p of parsed[r.rid].polys)g.poly(p.flat(),true);
      g.fill({color:pixiHex(r.fill),alpha:r.selected ? .5 : .20});
      outline(g,r.selected?'#d9fff1':'#62949a',r.selected?1.7/viewport.scaled:.7/viewport.scaled,r.selected?1:.65);
    }
  };
  const drawLanes=()=>{
    lanes.clear();if(!scene)return;const show=visibleLayers(scene.mode);
    const paths=[...(show.routes?scene.routes:[]),...(show.influence?scene.influence:[])];
    for(const l of paths){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy),s=viewport.scaled;
      if(!len)continue;const ux=dx/len,uy=dy/len;
      for(let d=-(phase%(14/s));d<len;d+=14/s){const a=Math.max(0,d),b=Math.min(len,d+7/s);if(b>a)lanes.moveTo(l.x1+ux*a,l.y1+uy*a).lineTo(l.x1+ux*b,l.y1+uy*b);}
      outline(lanes,l.color,1/s,l.strength ? .25 : .65);
    }
  };
  const layout=()=>{
    if(!scene)return;
    const z=ratio(),s=viewport.scaled;level=lodFor(z).id;
    tilt=1-(1-TILT)*Math.min(1,Math.max(0,(z-1.4)/1.6));plane.scale.y=tilt;
    const show=visibleLayers(scene.mode);
    for(const t of textPool)t.removeFromParent();textIndex=0;
    overlay.removeChildren().forEach(c=>c.destroy({children:true}));hits=[];
    grid.clear();for(let x=0;x<=1000;x+=100)grid.moveTo(x,0).lineTo(x,520);for(let y=0;y<=520;y+=52)grid.moveTo(0,y).lineTo(1000,y);grid.stroke({color:0x548b94,width:.5/s,alpha:.12});
    drawLand();rings.clear();
    for(const r of scene.rings){rings.circle(r.x,r.y,r.r).fill({color:pixiHex(r.color),alpha:.055}).stroke({color:pixiHex(r.color),alpha:r.preview ? .95 : .6,width:(r.preview?1.8:1)/s});}
    const small=sw()<650;
    const callouts=z<1.6?layoutLabels(scene.regions.map(r=>{const p=viewport.toScreen(r.cx,r.cy*tilt);return {id:r.rid,x:p.x,y:p.y,w:Math.max(100,r.name.length*(small?5.5:6.5)+18),h:52};}),{width:sw(),height:sh()}):[];
    // World labels form the primary interaction targets; tactical labels yield to facilities.
    for(const r of scene.regions){
      const p=viewport.toScreen(r.cx,r.cy*tilt);
      const label=z<1.6?callouts.find(c=>c.id===r.rid):null;
      const dx=label?(label.x-p.x)/s:0,dy=label?(label.y-p.y)/s/tilt:0;
      const cx=r.cx+dx,cy=r.cy+dy;
      const c=pin(cx,cy);const g=c.addChild(new Graphics());const w=label?.w||(small?106:140);
      if(label&&(dx||dy)){g.moveTo(0,0).lineTo(-dx*s,-dy*s*tilt).stroke({color:0x6c9296,width:.7,alpha:.65});}
      if((z<3||r.selected)&&(z>=1.6||label)){
        g.roundRect(-w/2,-22,w,43,4).fill({color:0x0b202b,alpha:.94}).stroke({color:r.selected?0xb6f6df:0x31515d,width:1});
        text(c,r.name,0,-10,small?10:12,r.selected?'#d6fff0':'#b5d0d4');
        text(c,r.line2.replace('⚓ ',''),0,8,small?10:11,r.line2Color,'700');
        if(r.line3&&z>=1.6)text(c,r.line3,0,30,10,COLOR.text.muted);
        pick('region',r.rid,cx,cy,26,{width:w,height:44});
      }
      if(r.hatch&&z>=1.6&&z<3)text(c,'CONTESTED',0,-32,9,'#c4b381');
      if(r.deployed&&['military','sphere'].includes(scene.mode)){const f=pin(r.cx,r.cy+40/s/tilt);f.addChild(new Graphics()).roundRect(-32,-10,64,20,3).fill(0x193c4c).stroke({color:0x70b5ce,width:1});text(f,`${r.deployed} units`,0,0,11,'#b7e6f5');pick('region',r.rid,r.cx,r.cy+40/s/tilt,25);}
      if(r.trend&&scene.mode==='sphere'&&z>=1.6&&z<3)text(c,`${r.trend>0?'↑':'↓'} ${Math.abs(r.trend)}`,w/2+14,6,10,r.trend>0?'#8bdbb0':'#e7ae8e');
      if(r.intel&&scene.mode==='intel'){g.rect(-w/2-6,-16,3,29).fill(0xa5a0df);}
      if(r.flashpoint){g.poly([-7,-36,0,-48,7,-36],true).fill(0xf5b85f);text(c,`${r.flashpoint.t}mo`,22,-40,10,'#f5b85f');}
    }
    // Nearby facilities group into a numbered stack. Clicking lists every member in the inspector.
    groups=layoutSites(show.sites||scene.build?scene.sites:scene.sites.filter(x=>x.selected),{zoom:z,scale:s,tilt,build:scene.build});
    const labelRects=[];
    for(const st of groups){const screen=viewport.toScreen(st.x,st.y*tilt);
      const c=pin(st.x,st.y),g=c.addChild(new Graphics());const col=st.selected?'#d0ffe9':st.candidate?'#86c8aa':st.mine?'#79d7b2':'#8ea8b6';
      g.roundRect(-17,-17,34,34,5).fill({color:0x0a1a25,alpha:.97});outline(g,st.building?'#edc580':col,st.selected?2:1,.9);
      if(st.ids.length>1){g.roundRect(-12,-13,23,23,2).stroke({color:pixiHex(col),width:1,alpha:.4});text(c,String(st.ids.length),0,0,14,col,'800');}
      else {for(const poly of SYMBOLS[st.type]||SYMBOLS.garrison)g.poly(poly,true);g.fill(pixiHex(col));}
      if(st.building){const node=st.nodes.find(n=>n.status==='building'&&n.owner===scene.pid);const progress=node?.progress??0;g.rect(-13,20,26,3).fill(0x29414d);g.rect(-13,20,26*progress,3).fill(0xedc580);}
      if(st.closed){g.moveTo(-13,13).lineTo(13,-13).stroke({color:0xf28e70,width:2});}
      const label=st.ids.length>1?`${st.ids.length} nearby sites`:st.name;
      const width=label.length*6.2+12;const rect={x:screen.x-width/2,y:screen.y+24,w:width,h:16};
      if(st.selected||!labelRects.some(a=>a.x<rect.x+rect.w&&a.x+a.w>rect.x&&a.y<rect.y+rect.h&&a.y+a.h>rect.y)){
        g.roundRect(-width/2,24,width,17,3).fill({color:0x081923,alpha:.95});text(c,label,0,32,11,col);labelRects.push(rect);
      }
      pick(st.ids.length>1?'cluster':'site',st.id,st.x,st.y,22,{ids:st.ids});
    }
    if(show.chokepoints)for(const cp of scene.chokepoints){const c=pin(cp.x,cp.y),g=c.addChild(new Graphics());g.poly([0,-9,9,0,0,9,-9,0],true).fill({color:pixiHex(cp.color)}).stroke({color:0x081923,width:2});if(z>=1.6)text(c,cp.name,0,20,11,'#d7cba5');pick('choke',cp.k,cp.x,cp.y,22);}
    drawLanes();onViewChange?.(z,level);
  };
  viewport.on('clicked',e=>{
    let hit=null,best=Infinity;for(const h of hits){const d=Math.hypot(e.world.x-h.x,e.world.y-h.y)*viewport.scaled;if((h.width?Math.abs(e.world.x-h.x)*viewport.scaled<h.width/2&&Math.abs(e.world.y-h.y)*viewport.scaled<h.height/2:d<h.r)&&d<best){hit=h;best=d;}}
    if(hit?.kind==='site')onSiteTap?.(hit.id);
    else if(hit?.kind==='cluster')onClusterTap?.(hit.ids);
    else if(hit?.kind==='choke')onChokeTap?.(hit.id);
    else onTap?.(hit?.id||regionAt(parsed,e.world.x,e.world.y/tilt,15/viewport.scaled));
  });
  viewport.on('zoomed',layout);viewport.on('moved',()=>onViewChange?.(ratio(),level));
  const ro=new ResizeObserver(()=>{const old=ratio();app.resize();viewport.resize(sw(),sh(),1000,520);clamp();if(old<1.1){viewport.setZoom(fitScale(),true);viewport.moveCenter(500,260);}layout();});ro.observe(container);
  app.ticker.add(t=>{frames++;count++;const now=performance.now();if(now-last>1000){fps=count*1000/(now-last);count=0;last=now;}if(!reduced()&&scene&&visibleLayers(scene.mode).routes&&scene.routes.length){phase+=t.deltaTime*.22;drawLanes();}});
  const zoomTo=(s,x,y)=>{viewport.setZoom(Math.max(fitScale(),Math.min(fitScale()*8,s)),true);if(x!=null)viewport.moveCenter(x,y);layout();};
  return {kind:'pixi',app,viewport,tilt:TILT,update(sc){scene=sc;layout();},
    focus(rid){const r=parsed[rid];if(r)zoomTo(Math.max(viewport.scaled,fitScale()*2.4),r.cx,r.cy*TILT);},
    focusPoint(p){if(p)zoomTo(Math.max(viewport.scaled,fitScale()*3),p.x,p.y*TILT);},
    focusSite(id){const st=scene?.sites.find(x=>x.id===id);if(st)zoomTo(Math.max(viewport.scaled,fitScale()*4),st.x,st.y*TILT);},
    pan(dx,dy){viewport.x+=dx;viewport.y+=dy;layout();},zoom:z=>zoomTo(z),zoomBy:f=>zoomTo(viewport.scaled*f),fit:()=>zoomTo(fitScale(),500,260),
    level:()=>level,layers:()=>({...layersAt(ratio()),rings:!!scene?.rings.length}),scale:()=>viewport.scaled,relativeZoom:ratio,
    visibleSites:()=>groups.map(g=>g.ids),projection:()=>tilt,screenPoint:(x,y)=>viewport.toScreen(x,y*tilt),
    fps:()=>fps,frames:()=>frames,destroy(){ro.disconnect();for(const t of textPool){t.removeFromParent();t.destroy();}app.destroy(true,{children:true,texture:true});}};
}
