const paths={
 box:'<path d="M3 7l9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5m-9 5v10"/>',
 archive:'<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M5 9v11h14V9m-10 4h6"/>',
 vr:'<path d="M5.5 6.7h13a2 2 0 0 1 2 1.6l1.2 7.6a2 2 0 0 1-2 2.3h-3.6c-1.8 0-2.6-2.8-4.1-2.8s-2.3 2.8-4.1 2.8H4.3a2 2 0 0 1-2-2.3l1.2-7.6a2 2 0 0 1 2-1.6Z"/><circle cx="7.5" cy="12" r="1.3"/><circle cx="16.5" cy="12" r="1.3"/>',
 arrowUpRight:'<path d="M6 18 18 6M7 6h11v11"/>',expand:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
 minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14M12 5v14"/>',focus:'<path d="M3 9V5h4m10 0h4v4m0 6v4h-4M7 19H3v-4"/><circle cx="12" cy="12" r="2"/>',
 orbit:'<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="4.6" transform="rotate(-28 12 12)"/>',
 sliders:'<path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h2m4 0h12"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
 reset:'<path d="M4 5v5h5M4.3 10a8 8 0 1 1 1.7 8"/>',down:'<path d="m6 9 6 6 6-6"/>',play:'<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
 pause:'<path d="M8 5v14m8-14v14" stroke-width="4"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 3 4-6 4 5"/>',
 x:'<path d="m6 6 12 12M18 6 6 18"/>',left:'<path d="m14 5-7 7 7 7"/>',right:'<path d="m10 5 7 7-7 7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>'
};
export function icon(name){return '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>'}
export function insertIcons(){document.querySelectorAll('[data-i]').forEach(i=>{i.outerHTML=icon(i.dataset.i)})}
