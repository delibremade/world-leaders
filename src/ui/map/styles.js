export const atlasStyles=`
.wl-deployment-orders{padding:12px 0;border-bottom:1px solid #2c4653;min-width:0;flex-shrink:0}.wl-deployment-stock{margin:12px 0;line-height:1.45}.wl-deployment-stock b{display:block;font-size:13px}.wl-deployment-stock small{display:block;color:#9bb7bf;font-size:11px;margin-top:5px}.wl-deployment-buttons{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:6px}.wl-deployment-buttons button{min-height:44px;margin:0;line-height:1.4;padding:8px 5px;white-space:normal}.wl-deployment-orders select{max-width:100%;min-width:0;min-height:44px}.wl-deployment-orders button:disabled{opacity:.45;cursor:not-allowed}.wl-deployment-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start;padding:4px;width:100%;min-width:0}.wl-deployment-workspace>*{min-width:0}.wl-deployment-assignment{padding:12px 0;border-bottom:1px solid #2c4653}.wl-deployment-assignment h3{margin:0 0 4px;font-size:15px}.wl-deployment-assignment>small{color:#9bb7bf}.wl-deployment-workspace .wl-map-shortcuts button,.wl-deployment-orders .wl-map-shortcuts button{min-height:40px}.wl-operations-scroll{overscroll-behavior:contain}
@media(max-width:899px){.wl-deployment-workspace{grid-template-columns:minmax(0,1fr)}}
.wl-atlas-workspace{min-height:0;flex:1;display:flex;gap:0}
.wl-atlas-workspace>.wl-mv-stage{min-width:0;width:100%}
.wl-operations{width:254px;flex:0 0 254px;min-height:0;background:#0c1b24;border-left:1px solid #29434d;color:#d2e6e8;display:flex;flex-direction:column;font-size:12px}
.wl-map-search{display:block;padding:16px;border-bottom:1px solid #233d47}
.wl-map-search span,.wl-map-eyebrow{display:block;color:#7ca0a7;font-size:10px;font-weight:700;letter-spacing:1.3px;line-height:1.5}
.wl-map-search input{margin-top:7px;width:100%;min-height:38px;border-radius:5px;border:1px solid #34515c;background:#08161f;color:#ddf2ed;padding:8px;font:inherit}
.wl-operations-scroll{padding:16px;overflow:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#36525d transparent}
.wl-operations-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:16px}
.wl-operations h3{font-size:20px;font-weight:600;line-height:1.2;margin:5px 0 0;color:#edf8f5}
.wl-map-close{border:1px solid #34515c;background:transparent;color:#b2cbd0;border-radius:4px;width:32px;height:32px;font-size:20px;flex-shrink:0;cursor:pointer}
.wl-map-intro{padding:8px 0 20px}.wl-map-intro b{display:block;font-size:14px}.wl-map-intro p,.wl-map-muted{color:#94aeb4;line-height:1.6;font-size:12px;margin:9px 0 14px}
.wl-atlas-mark{display:block;color:#80d0b1;font-size:48px;line-height:1.4}
.wl-theater-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 16px}
.wl-theater-grid button{background:#102730;border:1px solid #27444e;padding:10px 8px;border-radius:4px;text-align:left;color:#d0e3e5;font-size:11px;min-height:51px;cursor:pointer}
.wl-theater-grid span{display:block;color:#7eaaa6;font-size:10px;margin-top:5px}
.wl-map-shortcuts{display:flex;flex-wrap:wrap;gap:8px;margin:15px 0}.wl-map-shortcuts button{background:none;border:0;color:#92cbbc;font:inherit;text-align:left;padding:4px 0;cursor:pointer}
.wl-map-row{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;background:transparent;border:0;border-bottom:1px solid #233b45;color:#cce2e3;text-align:left;padding:8px 0;cursor:pointer;font:inherit}.wl-map-row>span:nth-child(2),.wl-map-row>b{flex:1}.wl-map-row small,.wl-map-unit small{display:block;color:#8caab0;font-size:11px;line-height:1.5;margin-top:3px}
.wl-facility{width:26px;height:26px;flex-shrink:0;color:#87d5b5}.wl-facility-large{width:150px;height:108px;display:block;margin:auto;color:#95e0c6}
.wl-facility-preview{background:radial-gradient(ellipse at center,#203b43,#0b1b25);border:1px solid #2d4952;border-radius:7px;padding:8px 8px 14px;text-align:center;margin-bottom:12px}.wl-facility-preview span{display:block;font-size:10px;color:#8db5b5;margin-bottom:4px}.wl-facility-preview b{font-size:14px}
.wl-map-host{display:flex;justify-content:space-between;width:100%;border:0;background:none;color:#a4c6c2;padding:6px 0 12px;font:inherit;text-align:left;cursor:pointer}
.wl-map-type-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:2px 0 14px}.wl-map-type-grid button{display:flex;flex-direction:column;align-items:center;gap:5px;background:#10242e;border:1px solid #304b55;color:#b1c7cc;border-radius:4px;padding:8px 3px;font-size:10px;cursor:pointer;min-height:66px}.wl-map-type-grid button[aria-pressed=true]{background:#163a3b;border-color:#86d4b5;color:#d8fff0}
.wl-map-facts{display:flex;gap:12px;justify-content:space-between;margin:14px 0;padding:12px 0;border-top:1px solid #27414b;border-bottom:1px solid #27414b}.wl-map-facts b{display:block;font-size:17px;font-weight:600;color:#e0f3ec}.wl-map-facts span{display:block;font-size:10px;color:#95b2b8;margin-top:5px}
.wl-map-reach{padding:8px 0 12px}.wl-map-reach p{margin:7px 0;color:#c1dfd4;font-size:12px;line-height:1.5}.wl-map-reach small{color:#91afb7;line-height:1.5}
.wl-map-gate{border-left:2px solid #d6b170;background:#292b24;padding:10px;color:#e0cc9c;font-size:11px;line-height:1.5}
.wl-map-primary,.wl-map-secondary{width:100%;padding:12px 8px;border:1px solid #80cdb1;background:#17473f;color:#d9fff0;border-radius:4px;font-size:12px;cursor:pointer}.wl-map-secondary{margin-top:10px;border-color:#37505a;background:transparent;color:#a5c2c5;font-size:11px}
.wl-operations button:disabled{opacity:.45;cursor:not-allowed}.wl-operations button:hover:enabled{filter:brightness(1.2)}.wl-operations :focus-visible{outline:2px solid #b9eede;outline-offset:2px}
.wl-map-unit{display:flex;gap:5px;align-items:center;border-bottom:1px solid #24414b;padding:12px 0}.wl-map-unit>div{flex:1;min-width:0}.wl-map-unit b{font-size:12px}.wl-map-unit button{width:32px;height:34px;border:1px solid #3f6a6d;background:#123b3d;color:#c4e8df;border-radius:4px;font-size:18px;cursor:pointer}
.wl-map-posture{display:block;font-size:11px;color:#9dbbbf;margin-top:15px}.wl-map-posture select{margin-top:6px;width:100%;height:38px;background:#102832;border:1px solid #3c5863;color:#d8eded;border-radius:4px;padding:6px;font:inherit}
.wl-map-sites summary{cursor:pointer;padding:12px 0;color:#b7cec9}.wl-corridor-state{color:#99dfbb;text-transform:capitalize;display:flex;gap:8px;align-items:center}.wl-corridor-state i{width:8px;height:8px;background:currentColor;transform:rotate(45deg)}.wl-corridor-state[data-corridor-state=disrupted]{color:#f4ae89}
@media(min-width:1100px){
 .wl-atlas-workspace{overflow:hidden;border:1px solid #29414c;border-radius:7px}
 .wl-atlas-workspace .wl-mv-stage{flex:1;min-height:240px;border-radius:0;container-type:size}
 .wl-atlas-workspace .wl-mv-dock{left:8px;right:8px;bottom:8px;justify-content:center;border-radius:5px;box-shadow:none}
 .wl-atlas-workspace .wl-mv-dock button{min-width:0;flex:1;padding:6px 3px;min-height:44px!important;font-size:10px}
 .wl-atlas-workspace .wl-mv-dock-i{font-size:13px}.wl-atlas-workspace .wl-mv-dock kbd{display:none}
 .wl-atlas-workspace .wl-mv-legend{left:10px;bottom:74px;max-width:200px;background:#081923e8;padding:7px 9px;font-size:9px!important;gap:5px;border:1px solid #29424e;box-shadow:none}
 .wl-atlas-workspace .wl-mv-glyphs{display:none}.wl-atlas-workspace .wl-mv-legend>.wl-label{flex-basis:100%;font-size:9px}
 .wl-atlas-workspace .wl-mv-zoom{gap:3px;right:8px;top:8px}.wl-atlas-workspace .wl-mv-lod{top:10px;left:10px}
 .wl-atlas-workspace .wl-mv-stage>svg{height:100%;max-height:100%;position:absolute;inset:0}
 .wl-mv>.wl-atlas-workspace{display:flex}
}
@media(min-width:1680px){.wl-operations{width:310px;flex-basis:310px}.wl-operations-scroll{padding:20px}.wl-atlas-workspace .wl-mv-dock kbd{display:inline-block}}
@media(min-width:1100px) and (max-width:1679px){.wl-facility-preview{display:grid;grid-template-columns:90px minmax(0,1fr);column-gap:8px;text-align:left;padding:8px}.wl-facility-preview .wl-facility-large{width:90px;height:65px;grid-row:1 / 3}.wl-facility-preview span{align-self:end}.wl-facility-preview b{font-size:12px;align-self:start}}
.wl-sheet-body .wl-operations{width:100%;border:0}.wl-sheet-body .wl-operations-scroll{padding:12px 0}.wl-map-inspector .wl-reserve-desk{margin:16px 0}
@media(max-width:1099px){.wl-atlas-workspace{display:block}.wl-atlas-workspace .wl-mv-stage{width:100%}}
`;
