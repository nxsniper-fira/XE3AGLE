import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      colors: {
        brand: {
          orange: '#ff7a1a',
          orangeSoft: '#ff8f43',
          background: '#08090b',
          panel: '#111827',
          card: '#12151d',
        },
      },
    },
  },
  plugins: [],
};

export default config;
