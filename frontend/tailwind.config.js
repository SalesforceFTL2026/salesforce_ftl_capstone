/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Display/identity face — condensed small-caps, used for headings & nav only.
        display: ['"Alumni Sans SC"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Body face — readable grotesk for all running text.
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palette derived from the MapResponse logo: forest green letters,
        // globe teal/sage, and the red map-pin (our urgency accent).
        forest: {
          50: '#f2f5ef',
          100: '#e2e9dc',
          200: '#c4d1b8',
          300: '#9db088',
          400: '#7f9764', // existing sage — kept as a brand mid-tone
          500: '#5f7748',
          600: '#48603a', // existing accent green
          700: '#37492e',
          800: '#273a20', // existing deep green
          900: '#1c2a16', // existing near-black green (brand ink)
        },
        sky: {
          100: '#e6f0ff',
          200: '#c1daff', // existing pale blue
          300: '#9cc0f5',
          400: '#79a7ed', // existing header blue
          500: '#5a92c2',
          600: '#4a7ba7',
        },
        // Coral map-pin accent — reserved for urgency, the primary CTA, and focus.
        pin: {
          400: '#ff6b5e',
          500: '#e8503f',
          600: '#c93d2e',
        },
        // Semantic surface/ink tokens (values live in :root / .dark via CSS vars).
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(28 42 22 / 0.04), 0 8px 24px -12px rgb(28 42 22 / 0.18)',
        'card-hover': '0 2px 4px rgb(28 42 22 / 0.06), 0 16px 40px -16px rgb(28 42 22 / 0.28)',
      },
    },
  },
  plugins: [],
}
