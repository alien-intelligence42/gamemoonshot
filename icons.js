// Original line-art emblems (not official game art). Each is drawn on a 64×64 grid in currentColor.
const S = (body, extra = "") =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const EMBLEMS = {
  badge: S(
    `<path d="M22 6l7 17M42 6l-7 17"/><circle cx="32" cy="39" r="16"/>
     <path d="M32 29.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5-4.8-4.6 6.6-.9z" fill="currentColor" stroke-width="1.5"/>`
  ),
  crystal: S(
    `<path d="M20 10h24l10 14-22 32L10 24z"/><path d="M10 24h44"/>
     <path d="M20 10l6 14 6 32 6-32 6-14M26 24l6-14 6 14" stroke-width="2"/>`
  ),
  emerald: S(
    `<path d="M22 8h20l12 12v24L42 56H22L10 44V20z"/><path d="M26 18h12l6 6v16l-6 6H26l-6-6V24z" stroke-width="2"/>
     <path d="M22 8l4 10M42 8l-4 10M54 20l-10 4M54 44l-10-4M42 56l-4-10M22 56l4-10M10 44l10-4M10 20l10 4" stroke-width="2"/>`
  ),
  pickaxe: S(
    `<g transform="rotate(-45 32 32)"><path d="M8 20Q32 2 56 20" stroke-width="6"/><path d="M32 12v48" stroke-width="4"/></g>`
  ),
  katana: S(
    `<path d="M56 6C46 19 33 31 21 41" stroke-width="3.5"/><path d="M13 36l14 14" stroke-width="4"/>
     <path d="M19 44L8 56" stroke-width="6"/><path d="M11 49l3 3M14 46l3 3" stroke-width="1.5"/>`
  ),
  staff: S(
    `<path d="M10 54L54 10" stroke-width="4"/><path d="M8 48l8 8M48 8l8 8" stroke-width="7"/>
     <path d="M14 30c-5 0-6-7 0-7 1-6 10-6 11 0 5-1 7 5 2 7z" stroke-width="2.5"/>
     <path d="M40 54c-5 0-6-7 0-7 1-6 10-6 11 0 5-1 7 5 2 7z" stroke-width="2.5"/>`
  ),
  flag: S(
    `<path d="M22 58V10"/><circle cx="22" cy="7" r="3" fill="currentColor"/>
     <path d="M22 13l24 8-24 8z" fill="currentColor" stroke-width="2"/><path d="M12 58h20"/>
     <path d="M40 58v-8h12v8" stroke-width="2.5"/>`
  ),
  at: S(
    `<rect x="7" y="7" width="50" height="50" rx="5"/>
     <text x="32" y="44" text-anchor="middle" font-size="34" font-weight="700" font-family="ui-monospace,Menlo,monospace" fill="currentColor" stroke="none">@</text>`
  ),
  spire: S(
    `<path d="M32 4l9 18H23z"/><path d="M25 22l-4 36h22l-4-36"/><path d="M23 34h18M22 46h20" stroke-width="2"/>
     <path d="M29 27h6v5h-6z" fill="currentColor" stroke-width="1.5"/><path d="M12 58h40"/>`
  ),
  shield: S(
    `<path d="M32 6l20 8v16c0 14-10 24-20 28C22 54 12 44 12 30V14z"/>
     <path d="M32 15v31M25 38h14M32 46v5" stroke-width="3.5"/>`
  ),
};

// Modern-3D boards: a golden tree in a halo, a palm against a striped sun, a cyberware chip, dog tags.
Object.assign(EMBLEMS, {
  tree: S(
    `<circle cx="32" cy="30" r="26" stroke-width="1.5" opacity=".55"/><circle cx="32" cy="30" r="20" stroke-width="1" opacity=".35"/>
     <path d="M32 58V24" stroke-width="3.5"/><path d="M26 58c3-3 4-7 6-12 2 5 3 9 6 12" stroke-width="2.5"/>
     <path d="M32 40c-7-2-12-7-15-14M32 34c6-2 11-6 14-13M32 28c-3-5-3-11 0-17M24 31c-6 1-11-1-14-5M40 26c5 0 9-2 12-6M28 22c-4-2-6-6-7-10M36 21c3-3 4-7 4-11" stroke-width="2.2"/>
     <path d="M20 58h24" stroke-width="2.5"/>`
  ),
  palm: S(
    `<g class="sun"><circle cx="44" cy="40" r="12" stroke-width="2.5"/><path d="M33 43h22M34 48h20M37 53h14" stroke-width="2"/></g>
     <path d="M20 58C22 46 23 33 28 21" stroke-width="3.5"/>
     <path d="M28 21c-6-4-14-4-21 1M28 21c-1-6-6-11-14-12M28 21c3-6 10-9 18-7M28 21c6-1 12 2 16 8M28 21c0 6-2 11-6 14" stroke-width="2.5"/>
     <path d="M6 58h52" stroke-width="2.5"/>`
  ),
  chip: S(
    `<path d="M17 12h24l8 8v32H17z"/><path d="M24 22h16v20H24z" stroke-width="2"/><path d="M34 22l-6 10h8l-6 10" stroke-width="2"/>
     <path d="M10 22h7M10 30h7M10 38h7M10 46h7M49 30h6M49 38h6M49 46h6M24 52v6M32 52v6M40 52v6M24 6v6M32 6v6" stroke-width="2"/>`
  ),
  dogtag: S(
    `<path d="M24 6c-6 3-6 10-2 13M40 6c6 3 6 10 2 13" stroke-width="1.6" stroke-dasharray="1.5 3"/>
     <rect x="26" y="20" width="22" height="34" rx="8" transform="rotate(12 37 37)" stroke-width="2.2" opacity=".6"/>
     <rect x="14" y="18" width="24" height="38" rx="9"/><circle cx="26" cy="25" r="2.4" stroke-width="2"/>
     <path d="M20 34h12M20 40h12M20 46h8" stroke-width="2.2"/>`
  ),
});

// Strategy, engineering and story boards: a rocket in a gear, a rocket on its way to a moon,
// a hex in a laurel wreath, a twenty-sided die.
Object.assign(EMBLEMS, {
  gear: S(
    `<path d="M52.1 25.9L58.4 26.2L58.4 37.8L52.1 38.1L50.5 41.9L54.7 46.6L46.6 54.7L41.9 50.5L38.1 52.1L37.8 58.4L26.2 58.4L25.9 52.1L22.1 50.5L17.4 54.7L9.3 46.6L13.5 41.9L11.9 38.1L5.6 37.8L5.6 26.2L11.9 25.9L13.5 22.1L9.3 17.4L17.4 9.3L22.1 13.5L25.9 11.9L26.2 5.6L37.8 5.6L38.1 11.9L41.9 13.5L46.6 9.3L54.7 17.4L50.5 22.1z" stroke-width="2.5"/>
     <path d="M32 18c4.5 4 5.5 10 4.5 16h-9c-1-6 0-12 4.5-16z" stroke-width="2.4"/><circle cx="32" cy="26.5" r="2" stroke-width="1.8"/>
     <path d="M27.5 31l-4 5.5h4.5M36.5 31l4 5.5H36M30 38.5l2 4.5 2-4.5" stroke-width="2"/>`
  ),
  rocket: S(
    `<circle cx="49" cy="15" r="10" stroke-width="2.5"/><circle cx="46" cy="12" r="2" stroke-width="1.5"/><circle cx="52" cy="19" r="1.4" stroke-width="1.4"/>
     <path d="M10 58C14 42 24 30 36 23" stroke-width="2" stroke-dasharray="2 4.5"/>
     <g transform="rotate(45 22 38)"><path d="M22 24c4 4 5 10 4 16h-8c-1-6 0-12 4-16z" stroke-width="2.6"/>
     <path d="M18 35l-4 6h4.5M26 35l4 6h-4.5M20 42l2 5 2-5" stroke-width="2.2"/></g>`
  ),
  laurel: S(
    `<path d="M32 19l11 6.5v13L32 45l-11-6.5v-13z" stroke-width="2.6"/><path d="M32 25.5l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="currentColor" stroke-width="1"/>
     <path d="M24 56C12 52 6 40 9 24M40 56c12-4 18-16 15-32" stroke-width="2.4"/>
     <g stroke-width="2"><path d="M11 45c-4-1-6-4-6-7 4 0 6 3 6 7zM8 35c-4-2-5-5-4-8 4 1 5 4 4 8zM8.5 26c-3-3-3-6-1-9 3 2 3 5 1 9zM18 52c-4 1-7-1-8-4 4-1 7 1 8 4z"/>
     <path d="M53 45c4-1 6-4 6-7-4 0-6 3-6 7zM56 35c4-2 5-5 4-8-4 1-5 4-4 8zM55.5 26c3-3 3-6 1-9-3 2-3 5-1 9zM46 52c4 1 7-1 8-4-4-1-7 1-8 4z"/></g>`
  ),
  d20: S(
    `<path d="M32 4l24 14v28L32 60 8 46V18z"/><path d="M32 17L16 43h32z" stroke-width="2.4"/>
     <path d="M32 4v13M8 18l24-1 24 1M8 18l8 25M56 18l-8 25M8 46l8-3M56 46l-8-3M16 43l16 17 16-17" stroke-width="1.8"/>
     <text x="32" y="38" text-anchor="middle" font-size="11" font-weight="700" font-family="Georgia,serif" fill="currentColor" stroke="none">20</text>`
  ),
});

// Horseshoe nail holes, placed along the arc.
EMBLEMS.horseshoe = S(
  `<path d="M18 54l-4-22a18 18 0 0 1 36 0l-4 22" stroke-width="8"/>
   <g fill="currentColor" stroke="none" style="color:var(--ink-bg,#120f0b)">
     <circle cx="16.4" cy="44" r="1.5"/><circle cx="15.4" cy="34" r="1.5"/><circle cx="20" cy="22" r="1.5"/>
     <circle cx="47.6" cy="44" r="1.5"/><circle cx="48.6" cy="34" r="1.5"/><circle cx="44" cy="22" r="1.5"/>
   </g>`
);

const U = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const UI = {
  play: U(`<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>`),
  close: U(`<path d="M6 6l12 12M18 6L6 18"/>`),
  external: U(`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
  trophy: U(`<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4"/>`),
  sword: U(`<path d="M19 3l-9 9M14 3h5v5M7 13l4 4M5 15l4 4M3 21l3-3"/>`),
  scroll: U(`<path d="M7 4h11a2 2 0 0 1 0 4H9M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M9 12h6M9 16h4"/>`),
  film: U(`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>`),
  chart: U(`<path d="M4 20V4M4 20h16M7 16l4-5 3 3 5-7"/>`),
  flame: U(`<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>`),
  user: U(`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`),
  chevron: U(`<path d="M9 6l6 6-6 6"/>`),
  sun: U(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`),
  moon: U(`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`),
  // Why-games page
  gamepad: U(`<path d="M6.5 7.5h11A4.5 4.5 0 0 1 22 12l-.4 3.6a2.8 2.8 0 0 1-4.9 1.5L15 15.5H9l-1.7 1.6a2.8 2.8 0 0 1-4.9-1.5L2 12a4.5 4.5 0 0 1 4.5-4.5z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="15.5" cy="11" r=".9" fill="currentColor" stroke="none"/><circle cx="17.8" cy="13" r=".9" fill="currentColor" stroke="none"/>`),
  lock: U(`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>`),
  crown: U(`<path d="M3 7.5l4.5 4L12 4.5l4.5 7 4.5-4-2 10.5H5z"/><path d="M5 21h14"/>`),
  skull: U(`<path d="M12 3a8 8 0 0 0-8 8c0 2.8 1.4 4.8 3.5 6v3.5h9V17c2.1-1.2 3.5-3.2 3.5-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.7" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.7" fill="currentColor" stroke="none"/><path d="M10.5 20.5v-2M13.5 20.5v-2M12 13.8l-.9 1.8h1.8z"/>`),
  heart: U(`<path d="M12 20s-7.2-4.4-9.1-9A4.6 4.6 0 0 1 12 8.6 4.6 4.6 0 0 1 21.1 11C19.2 15.6 12 20 12 20z"/>`),
  code: U(`<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>`),
  sigma: U(`<path d="M18 5H6l6.5 7L6 19h12"/>`),
  flask: U(`<path d="M9 3h6M10 3v6l-5.6 9.4A1.7 1.7 0 0 0 5.9 21h12.2a1.7 1.7 0 0 0 1.5-2.6L14 9V3M7.3 15h9.4"/>`),
  robot: U(`<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 5v3M9 16h6M3 12.5v3M21 12.5v3"/><circle cx="12" cy="4" r="1"/><circle cx="9.5" cy="12.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor" stroke="none"/>`),
  globe: U(`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>`),
  target: U(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>`),
  star: U(`<path d="M12 2.8l2.7 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.7 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/>`),
  check: U(`<path d="M5 12.5l4.5 4.5L19 7"/>`),
  coin: U(`<circle cx="12" cy="12" r="9"/><path d="M14.8 8.6c-.6-.8-1.6-1.3-2.8-1.3-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.6 5.8 4.8 0 1.3-1.3 2.3-3 2.3-1.3 0-2.4-.6-3-1.5M12 5.5v1.8M12 16.7v1.8"/>`),
};

// Ink-wash mountain silhouettes for banners; colors come from CSS custom properties.
export const MOUNTAINS = `
<svg class="mountains" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
  <path class="m1" d="M0 230L90 170 160 205 260 120 340 175 430 95 520 160 610 110 700 170 790 80 880 150 980 100 1070 165 1160 115 1250 170 1350 125 1440 160V320H0z"/>
  <path class="m2" d="M0 260L120 200 210 240 320 180 420 235 540 175 650 240 760 190 860 245 980 185 1090 240 1200 195 1320 245 1440 205V320H0z"/>
  <path class="m3" d="M0 290L140 250 260 285 400 245 520 290 660 255 800 295 940 255 1080 292 1220 258 1340 290 1440 268V320H0z"/>
</svg>`;
