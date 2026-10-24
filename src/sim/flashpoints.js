import { REGIONS } from '../data/regions.js';
// Regional crises describe external contests. Domestic political instability has its own issue/decision systems.
export const foreignFlashpoint=(fp,nid)=>fp&&REGIONS[fp.rid]?.homeFor?.includes(nid)?null:fp||null;
export const flashpointEligible=(g,rid)=>!REGIONS[rid]?.homeFor?.includes(g.country?.id)&&(g.sphere[rid]?.player||0)>15&&(g.sphere[rid]?.player||0)<75;
