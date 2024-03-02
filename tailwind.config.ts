import type { Config } from 'tailwindcss';

export default {
	content: ['./app/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				'sanguine-red': '#BB2C23',
			},
		},
	},
	plugins: [],
} satisfies Config;
