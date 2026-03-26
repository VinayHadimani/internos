import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#0D0D0D',
        elevated: '#141414',
        'border-default': '#1F1F1F',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
