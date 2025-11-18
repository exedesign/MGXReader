/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cinematic dark theme colors
        cinema: {
          black: '#0a0a0a',
          dark: '#1a1a1a',
          gray: '#2a2a2a',
          'gray-light': '#3a3a3a',
          accent: '#d4af37', // Gold accent
          'accent-dark': '#b8941f',
          text: '#e5e5e5',
          'text-dim': '#9a9a9a',
        }
      },
      fontFamily: {
        'screenplay': ['"Courier Prime"', 'Courier', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
