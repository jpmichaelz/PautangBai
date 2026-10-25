const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#173D35', 900: '#173D35' },
        bai: { DEFAULT: '#287A63', 700: '#287A63' },
        frog: '#75C99C',
        mint: '#A8DCC5',
        paper: '#BCE9CA',
        // Keep Tailwind shade scales; only override the bare color.
        amber: { ...colors.amber, DEFAULT: '#F0B85A' },
        slate: { ...colors.slate, DEFAULT: '#66716D' },
        ink: '#252B29',
        border: '#A6D9B6',
        danger: { ...colors.red, DEFAULT: '#DC2626', 600: '#DC2626' },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(23, 61, 53, 0.06)',
      },
    },
  },
  plugins: [],
};
