import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    fontFamily: {
      runescape: ['runescape', 'sans-serif'],
    },
    extend: {
      colors: {
        'sanguine-red': '#BB2C23',
      },
    },
  },
  plugins: [],
} satisfies Config;
