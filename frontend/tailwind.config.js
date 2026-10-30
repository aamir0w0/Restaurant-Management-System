const v = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: { primary: { DEFAULT: v('primary'), hover: v('primary-hover'), soft: v('primary-soft') }, accent: { DEFAULT: v('accent'), soft: v('accent-soft') }, sidebar: v('sidebar'), canvas: v('canvas'), ink: v('ink'), muted: v('muted'), line: v('line') },
    fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
    boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 4px 14px rgba(16,24,40,.05)', pop: '0 12px 32px rgba(16,24,40,.16)' },
    borderRadius: { xl: '0.9rem', '2xl': '1.25rem' },
  } },
  plugins: [],
};
