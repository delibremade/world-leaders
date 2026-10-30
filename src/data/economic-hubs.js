import {project} from './bases.js';

// Civilian geographic anchors, not bases or separate simulated economies. Sector tags describe
// representative activity, never shares of GDP. Nation identity always resolves through NATIONS.
// Sources, scope and the path to local production: docs/ECONOMIC-LAYERS.md.
export const ECONOMIC_SECTORS={
  technology:{name:'Technology',icon:'⌘',color:'#a8b8ef',budgets:['technology','education']},
  industry:{name:'Industry',icon:'▥',color:'#e6b688',budgets:['technology','energy']},
  food:{name:'Food',icon:'♧',color:'#b8d885',budgets:[]},
  energy:{name:'Energy',icon:'ϟ',color:'#f0ce79',budgets:['energy']},
  materials:{name:'Materials',icon:'◇',color:'#b5c7cf',budgets:[]},
  trade:{name:'Trade & logistics',icon:'⇄',color:'#80d1c8',budgets:[]},
  services:{name:'Services',icon:'▤',color:'#ddaccd',budgets:['healthcare','education']},
};
const H=(name,nation,lon,lat,sectors,role)=>({name,nation,lon,lat,sectors:sectors.split(' '),role,...project(lon,lat)});
export const ECONOMIC_HUBS={
  seattle:H('Seattle–Tacoma','usa',-122.33,47.61,'technology industry trade','Software, civilian aerospace and Pacific trade'),
  portland:H('Portland','usa',-122.68,45.52,'technology industry trade','Semiconductors, manufacturing and river freight'),
  bay_area:H('San Francisco Bay Area','usa',-122.1,37.5,'technology services trade','Software, research, finance and Pacific trade'),
  los_angeles:H('Los Angeles–Long Beach','usa',-118.24,34.05,'services trade industry','Entertainment, manufacturing and container trade'),
  san_diego:H('San Diego','usa',-117.16,32.72,'technology services','Biotechnology, research and health services'),
  central_valley:H('Central Valley / Fresno','usa',-119.79,36.74,'food trade','Agriculture, food processing and distribution'),
  phoenix:H('Phoenix','usa',-112.07,33.45,'technology industry','Semiconductors and advanced manufacturing'),
  salt_lake:H('Salt Lake City','usa',-111.89,40.76,'materials trade technology','Mineral processing, inland logistics and technology'),
  denver:H('Denver','usa',-104.99,39.74,'energy technology services','Energy services, engineering and research'),
  midland:H('Midland / Permian Basin','usa',-102.08,31.99,'energy materials','Oil, gas and extraction services'),
  dallas:H('Dallas–Fort Worth','usa',-96.8,32.78,'trade technology services','Distribution, business services and technology'),
  austin:H('Austin','usa',-97.74,30.27,'technology industry','Semiconductors, software and manufacturing'),
  houston:H('Houston','usa',-95.37,29.76,'energy industry trade','Energy, petrochemicals and Gulf trade'),
  omaha:H('Omaha','usa',-95.94,41.26,'food trade services','Food processing, rail logistics and finance'),
  des_moines:H('Des Moines','usa',-93.62,41.59,'food services','Agribusiness and financial services'),
  kansas_city:H('Kansas City','usa',-94.58,39.1,'trade food industry','Rail distribution, food processing and manufacturing'),
  minneapolis:H('Minneapolis–Saint Paul','usa',-93.27,44.98,'food services industry','Food businesses, medical technology and services'),
  chicago:H('Chicago','usa',-87.63,41.88,'trade services industry','Rail and air logistics, finance and manufacturing'),
  detroit:H('Detroit','usa',-83.05,42.33,'industry technology','Automotive manufacturing and engineering'),
  pittsburgh:H('Pittsburgh','usa',-80,40.44,'materials technology industry','Materials, robotics and industrial research'),
  memphis:H('Memphis','usa',-90.05,35.15,'trade food','Air cargo, river freight and food distribution'),
  atlanta:H('Atlanta','usa',-84.39,33.75,'trade services technology','Air logistics, business services and technology'),
  new_york:H('New York–New Jersey','usa',-74.01,40.71,'services trade technology','Finance, media, services and Atlantic trade'),
  boston:H('Boston','usa',-71.06,42.36,'technology services','Biotechnology, universities and health services'),
  miami:H('Miami','usa',-80.19,25.76,'trade services','Americas trade, business services and tourism'),
  havana:H('Havana','cuba',-82.37,23.11,'services technology trade','Health services, biotechnology and trade'),
  mariel:H('Mariel','cuba',-82.75,23,'trade industry','Port logistics and industrial activity'),
  santa_clara:H('Santa Clara','cuba',-79.97,22.41,'food industry services','Food processing, manufacturing and regional services'),
  beijing:H('Beijing','china',116.41,39.9,'technology services','Research, technology and national services'),
  shanghai:H('Shanghai','china',121.47,31.23,'trade services industry','Container trade, finance and manufacturing'),
  shenzhen:H('Shenzhen','china',114.06,22.54,'technology industry trade','Electronics, technology and export industry'),
  chengdu:H('Chengdu','china',104.07,30.57,'technology industry food','Inland electronics, manufacturing and food businesses'),
  tokyo:H('Tokyo–Yokohama','japan',139.69,35.68,'services technology trade','Finance, research and Pacific trade'),
  osaka:H('Osaka–Kobe','japan',135.5,34.69,'industry trade services','Manufacturing, port logistics and business services'),
  nagoya:H('Nagoya','japan',136.91,35.18,'industry technology','Automotive manufacturing and industrial engineering'),
  oslo:H('Oslo','norway',10.75,59.91,'services technology','Business services, research and technology'),
  bergen:H('Bergen','norway',5.32,60.39,'trade food energy','Shipping, seafood and energy services'),
  stavanger:H('Stavanger','norway',5.73,58.97,'energy industry','Offshore energy and industrial engineering'),
  moscow:H('Moscow','russia',37.62,55.75,'services technology','Business services, research and technology'),
  st_petersburg:H('Saint Petersburg','russia',30.32,59.93,'industry trade','Manufacturing and Baltic trade'),
  yekaterinburg:H('Yekaterinburg','russia',60.6,56.84,'materials industry trade','Metals, industrial production and inland logistics'),
  berlin:H('Berlin','germany',13.41,52.52,'technology services','Technology, research and services'),
  hamburg:H('Hamburg','germany',9.99,53.55,'trade industry','Port logistics and civilian aerospace'),
  ruhr:H('Rhine–Ruhr','germany',6.77,51.23,'industry materials energy','Industrial production, materials and energy'),
  munich:H('Munich','germany',11.58,48.14,'technology industry services','Engineering, automotive industry and technology'),
  sao_paulo:H('São Paulo','brazil',-46.63,-23.55,'services industry technology','Finance, manufacturing and technology'),
  rio:H('Rio de Janeiro','brazil',-43.17,-22.91,'energy services trade','Energy services, tourism and Atlantic trade'),
  cuiaba:H('Cuiabá / Mato Grosso','brazil',-56.1,-15.6,'food trade','Agriculture, food businesses and inland distribution'),
};
export const economicHubs=(nation,sector='all')=>Object.entries(ECONOMIC_HUBS)
  .filter(([,h])=>h.nation===nation&&(sector==='all'||h.sectors.includes(sector))).map(([id,h])=>({id,...h}));
// Padded extent shared by SVG and Pixi. Keeps small countries usable without changing any anchor.
export function economicBounds(hubs){
  if(!hubs.length)return {x:0,y:0,w:1000,h:520};
  const xs=hubs.map(h=>h.x),ys=hubs.map(h=>h.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const w=Math.max(110,Math.max(...xs)-Math.min(...xs)+45),h=Math.max(90,Math.max(...ys)-Math.min(...ys)+60);
  return {x:cx-w/2,y:cy-h/2,w,h};
}
