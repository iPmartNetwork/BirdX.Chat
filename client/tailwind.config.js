/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        birdx: {
          DEFAULT: '#10b981',
          dark: '#0c9d92',
          light: '#d1fae5',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        fa: ['"Vazirmatn"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 60px -30px rgba(16, 185, 129, 0.8)',
      },
    },
  },
  plugins: [],
}
