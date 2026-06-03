const accentBase = 'var(--birdx-accent, #10b981)';
const accentRgb = 'var(--birdx-accent-rgb, 16 185 129)';

const emeraldFromAccent = {
  50: `color-mix(in srgb, ${accentBase} 12%, white)`,
  100: `color-mix(in srgb, ${accentBase} 22%, white)`,
  200: `color-mix(in srgb, ${accentBase} 38%, white)`,
  300: `color-mix(in srgb, ${accentBase} 52%, white)`,
  400: `color-mix(in srgb, ${accentBase} 68%, white)`,
  500: `rgb(${accentRgb} / <alpha-value>)`,
  600: `color-mix(in srgb, ${accentBase} 88%, black)`,
  700: `color-mix(in srgb, ${accentBase} 72%, black)`,
  800: `color-mix(in srgb, ${accentBase} 58%, black)`,
  900: `color-mix(in srgb, ${accentBase} 44%, black)`,
  950: `color-mix(in srgb, ${accentBase} 30%, black)`,
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: emeraldFromAccent,
        birdx: {
          DEFAULT: accentBase,
          dark: `color-mix(in srgb, ${accentBase} 88%, black)`,
          light: `color-mix(in srgb, ${accentBase} 22%, white)`,
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        fa: ['"Vazirmatn"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 60px -30px color-mix(in srgb, var(--birdx-accent, #10b981) 80%, transparent)',
      },
    },
  },
  plugins: [],
}
