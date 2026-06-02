/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0c9d92',
          dark: '#020617',
          navy: '#14213d',
          deep: '#0a4134',
          emerald: '#10b981',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Vazirmatn', 'system-ui', 'sans-serif'],
        fa: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
