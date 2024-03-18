import { createCache, memoryStore } from "cache-manager";

export const excalidraw = (excaliDrawJson: string, drawingId: string): string =>
	`<div id="${drawingId}"></div><script>(function(){const InitialData=${excaliDrawJson};InitialData.scrollToContent=true;App=()=>{const e=React.useRef(null),t=React.useRef(null),[n,i]=React.useState({width:void 0,height:void 0});return React.useEffect(()=>{i({width:t.current.getBoundingClientRect().width,height:t.current.getBoundingClientRect().height});const e=()=>{i({width:t.current.getBoundingClientRect().width,height:t.current.getBoundingClientRect().height})};return window.addEventListener("resize",e),()=>window.removeEventListener("resize",e)},[t]),React.createElement(React.Fragment,null,React.createElement("div",{className:"excalidraw-wrapper",ref:t},React.createElement(ExcalidrawLib.Excalidraw,{ref:e,width:n.width,height:n.height,initialData:InitialData,viewModeEnabled:!0,zenModeEnabled:!0,gridModeEnabled:!1})))},excalidrawWrapper=document.getElementById("${drawingId}");ReactDOM.render(React.createElement(App),excalidrawWrapper);})();</script>`;

export const DEFAULT_CACHE = createCache(memoryStore(), {
	max: 1000,
	ttl: 900 * 1000, //ms
});
