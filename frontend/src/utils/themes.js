// Each theme is a set of RGB triplets exposed as CSS variables (see tailwind.config.js).
export const THEMES = {
  ocean: { label: 'Ocean Teal', primary: '15 138 138', hover: '11 112 112', soft: '224 244 244', accent: '242 140 40', accentSoft: '254 240 222', sidebar: '15 43 60', canvas: '244 247 249', ink: '17 31 42', muted: '100 116 130', line: '226 232 238' },
  forest: { label: 'Forest Green', primary: '36 76 58', hover: '25 59 44', soft: '231 239 234', accent: '217 119 69', accentSoft: '251 237 229', sidebar: '25 45 36', canvas: '247 246 242', ink: '32 41 35', muted: '107 116 110', line: '229 232 227' },
  terracotta: { label: 'Terracotta', primary: '194 87 52', hover: '161 68 38', soft: '252 238 231', accent: '217 160 45', accentSoft: '252 243 220', sidebar: '52 33 28', canvas: '251 247 244', ink: '40 28 24', muted: '120 104 98', line: '236 228 222' },
  midnight: { label: 'Midnight Indigo', primary: '99 102 241', hover: '79 70 229', soft: '237 238 254', accent: '236 72 153', accentSoft: '253 232 243', sidebar: '22 22 46', canvas: '246 246 252', ink: '22 22 40', muted: '105 108 135', line: '229 230 243' },
  rose: { label: 'Rose Berry', primary: '210 36 82', hover: '176 24 64', soft: '253 232 238', accent: '245 158 11', accentSoft: '254 243 220', sidebar: '44 20 30', canvas: '253 247 248', ink: '38 20 26', muted: '125 104 112', line: '240 228 231' },
};
export const RECEIPT_THEMES = { classic: 'Classic thermal', modern: 'Modern', minimal: 'Minimal' };
let current = 'ocean';
export function applyTheme(key) {
  const t = THEMES[key] || THEMES.ocean; current = THEMES[key] ? key : 'ocean'; const s = document.documentElement.style;
  [['primary', t.primary], ['primary-hover', t.hover], ['primary-soft', t.soft], ['accent', t.accent], ['accent-soft', t.accentSoft], ['sidebar', t.sidebar], ['canvas', t.canvas], ['ink', t.ink], ['muted', t.muted], ['line', t.line]].forEach(([k, v]) => s.setProperty(`--c-${k}`, v));
}
export const themeHex = (name = 'primary') => { const t = THEMES[current]; const trip = { primary: t.primary, accent: t.accent, sidebar: t.sidebar, line: t.line }[name] || t.primary; return '#' + trip.split(' ').map((n) => (+n).toString(16).padStart(2, '0')).join(''); };
