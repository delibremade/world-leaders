import { rng } from './rng.js';

// v57 monthly mean-reversion of every vital toward the nation's (shifted) equilibrium. 9 rng draws.
export function naturalDrift(s,ir,eq){
  // eq = country equilibrium (starting stats). Stats gravitate back toward these values.
  // Mean-reversion: drift = (target - current) * strength, so decay naturally slows near bottom.
  const r=rng,ns={...s},nd=3.0-ir,REV=0.012,e=eq||s;

  // INFLATION: mean-reverts to IR-determined target rather than accumulating
  const inflTgt=Math.max(1.0,3+nd*1.5+(s.debtGdp>105?1.5:s.debtGdp>90?0.5:0)-(s.treasury>5000?0.4:0));// nd=3-ir: high IR → negative nd → low target
  ns.inflation=Math.max(0,s.inflation+(inflTgt-s.inflation)*0.015+(r()-.5)*.07);

  // GDP: reverts to country's potential growth + condition bonuses
  const gdpPot=(e.gdpGrowth||1.5)+(s.education>75?(s.education-75)*0.002:0)+(s.treasury>5000?0.01:0)+(s.healthcare>80?0.01:0)+(s.inflation<4?0.04:s.inflation>10?-0.08:0);
  ns.gdpGrowth=s.gdpGrowth+(gdpPot-s.gdpGrowth)*0.018+(r()-.5)*.1;

  // UNEMPLOYMENT: reverts to structural rate
  const uTgt=(e.unemployment||5)+(ns.gdpGrowth<1?0.7:ns.gdpGrowth>2.5?-0.4:0);
  ns.unemployment=Math.max(0,s.unemployment+(uTgt-s.unemployment)*0.015+(r()-.5)*.05);

  // STABILITY: mean-reversion + hard-capped passive penalties (-0.05/tick max combined)
  const stabEq=(e.stability||65)+(ns.gdpGrowth>2?3:ns.gdpGrowth>0?0:-4);
  const stabGain=(ns.gdpGrowth>2.5?0.04:ns.gdpGrowth>1?0.015:0)+(s.healthcare>80?0.02:0)+(s.foodSecurity>80?0.015:0)+(s.treasury>3000?0.015:0);
  const rawPen=(ns.unemployment>15?-.11:ns.unemployment>12?-.04:0)+(ns.inequality>80?-.08:ns.inequality>76?-.03:0)+(ns.inflation>15?-.09:ns.inflation>11?-.03:0)+(ns.gdpGrowth<-3?-.06:0);
  ns.stability=Math.max(0,Math.min(100,s.stability+(stabEq-s.stability)*REV+stabGain+Math.max(-0.05,rawPen)+(r()-.5)*.03));

  // HEALTHCARE: balanced drift, negative bias removed
  ns.healthcare=Math.max(0,Math.min(100,s.healthcare+((e.healthcare||70)-s.healthcare)*REV*0.5+(r()-.5)*.05+(s.gdpGrowth>2?0.015:0)));

  // FOOD SECURITY
  ns.foodSecurity=Math.max(0,Math.min(100,s.foodSecurity+((e.foodSecurity||75)-s.foodSecurity)*REV*0.5+(r()-.5)*.05+(s.gdpGrowth>1?0.01:0)));

  // DEBT/GDP: mean-reverts — CRITICAL FIX (was +0.16/tick unconditionally)
  const debtEq=(e.debtGdp||60)+Math.max(0,(1.5-ns.gdpGrowth)*2.5)+(ns.inflation>8?1.5:0);
  ns.debtGdp=Math.max(0,s.debtGdp+(debtEq-s.debtGdp)*0.008+0.04+(r()-.5)*.04);

  // INEQUALITY: attractor + education/growth effects
  ns.inequality=Math.max(0,Math.min(100,s.inequality+((e.inequality||55)-s.inequality)*REV*0.4+(r()-.5)*.04+(s.education>78?-0.018:0)+(ns.gdpGrowth>3?-0.012:0)));

  // EDUCATION: attractor, grows with prosperity
  ns.education=Math.max(0,Math.min(100,s.education+((e.education||70)-s.education)*REV*0.4+(r()-.5)*.04+(s.gdpGrowth>2?0.012:0)));

  // MILITARY: tiny noise (defense tech bonus applied separately in tick)
  ns.military=Math.max(0,Math.min(100,s.military+(r()-.5)*.015));

  // TREASURY: net revenue after base operating costs (sector budgets deducted separately in tick)
  ns.treasury=s.treasury+Math.max(0,ns.gdpGrowth*40)+160-175-(s.healthcare>75?15:0);

  return ns;
}
