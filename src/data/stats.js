// Vital-stat labels, formatters and severity thresholds.
export const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const GOOD=['stability','healthcare','education','foodSecurity','gdpGrowth','treasury','military'];

export const SC={
  treasury:    {label:'Treasury',      fmt:v=>Math.abs(v)>=100000?`$${(v/1000000).toFixed(2)}T`:Math.abs(v)>=1000?`$${(v/1000).toFixed(1)}B`:`$${Math.round(v).toLocaleString()}M`, bad:'low', warnAt:800, critAt:0},
  gdpGrowth:   {label:'GDP Growth',    fmt:v=>`${v.toFixed(1)}%`,                   bad:'low', warnAt:0.5, critAt:-1},
  unemployment:{label:'Unemployment',  fmt:v=>`${v.toFixed(1)}%`,                   bad:'high',warnAt:10,  critAt:18},
  inflation:   {label:'Inflation',     fmt:v=>`${v.toFixed(1)}%`,                   bad:'high',warnAt:7,   critAt:14},
  stability:   {label:'Stability',     fmt:v=>`${v.toFixed(0)}/100`,                bad:'low', warnAt:50,  critAt:30},
  healthcare:  {label:'Healthcare',    fmt:v=>`${v.toFixed(0)}/100`,                bad:'low', warnAt:50,  critAt:35},
  education:   {label:'Education',     fmt:v=>`${v.toFixed(0)}/100`,                bad:'low', warnAt:50,  critAt:35},
  foodSecurity:{label:'Food Security', fmt:v=>`${v.toFixed(0)}/100`,                bad:'low', warnAt:50,  critAt:35},
  debtGdp:     {label:'Debt/GDP',      fmt:v=>`${v.toFixed(0)}%`,                   bad:'high',warnAt:85,  critAt:120},
  inequality:  {label:'Inequality',    fmt:v=>`${v.toFixed(0)}/100`,                bad:'high',warnAt:65,  critAt:80},
  military:    {label:'Military',      fmt:v=>`${v.toFixed(0)}/100`,                bad:'low', warnAt:35,  critAt:20},
};
export const ss=(k,v)=>{const c=SC[k];if(!c)return'ok';if(c.bad==='high'){if(v>=c.critAt)return'critical';if(v>=c.warnAt)return'warning';}else{if(v<=c.critAt)return'critical';if(v<=c.warnAt)return'warning';}return'ok';};
export const sc=s=>s==='critical'?'#ef4444':s==='warning'?'#f0c040':'#4ade80';
