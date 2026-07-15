import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores UNPHU
        unphu: {
          50:  '#f0f5ff',
          100: '#e0ebff',
          200: '#c0d6ff',
          300: '#91b9ff',
          400: '#5a93ff',
          500: '#2d6be4',
          600: '#1a4fb5',
          700: '#163e92',
          800: '#1a3a5c',  // azul principal UNPHU
          900: '#1a2e4a',
          950: '#111f33',
        },
        gold: {
          400: '#f5c842',
          500: '#e8b400',
          600: '#c49a00',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
      backgroundImage: {
        'unphu-gradient': 'linear-gradient(135deg, #1a3a5c 0%, #2d6be4 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
