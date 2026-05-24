/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  safelist: [
    { pattern: /^(bg|text|border|ring|shadow|from|via|to)-indigo-(50|100|200|300|400|500|600|700|800|900|950)/ },
    { pattern: /^(bg|text|border|ring|shadow|from|via|to)-indigo-(50|100|200|300|400|500|600|700|800|900|950)/, variants: ['dark', 'hover', 'focus', 'focus-visible'] },
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        fa: ['"Vazirmatn"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 60px -30px rgba(99, 102, 241, 0.8)',
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
    },
  },
  plugins: [],
}
