import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#111827',
        panelAlt: '#1f2937',
        accent: '#14b8a6',
        accentSoft: '#2dd4bf'
      }
    }
  },
  plugins: []
}

export default config
