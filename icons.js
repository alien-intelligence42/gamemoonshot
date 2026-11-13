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
};

// Ink-wash mountain silhouettes for banners; colors come from CSS custom properties.
export const MOUNTAINS = `
<svg class="mountains" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
  <path class="m1" d="M0 230L90 170 160 205 260 120 340 175 430 95 520 160 610 110 700 170 790 80 880 150 980 100 1070 165 1160 115 1250 170 1350 125 1440 160V320H0z"/>
  <path class="m2" d="M0 260L120 200 210 240 320 180 420 235 540 175 650 240 760 190 860 245 980 185 1090 240 1200 195 1320 245 1440 205V320H0z"/>
  <path class="m3" d="M0 290L140 250 260 285 400 245 520 290 660 255 800 295 940 255 1080 292 1220 258 1340 290 1440 268V320H0z"/>
</svg>`;
