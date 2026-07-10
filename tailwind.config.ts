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
        // Brighter red for text/hover accents where the base red is too dark to read.
        'sanguine-bright': '#E2564A',
        // The muted orange OSRS uses for interface labels; table chrome, not content.
        'osrs-orange': '#C98A45',
        // In-game gold for clan point values.
        'osrs-gold': '#D9A13C',
      },
    },
  },
  plugins: [],
} satisfies Config;
