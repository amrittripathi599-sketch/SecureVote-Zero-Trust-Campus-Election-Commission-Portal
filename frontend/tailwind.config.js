/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#ccfbe9',
          200: '#9cf6d6',
          300: '#5debbb',
          400: '#26d79e',
          500: '#0ea577',
          600: '#088661',
          700: '#0a6b50',
          800: '#0c5541',
          900: '#0c4737',
          950: '#032820',
        },
        navy: {
          700: '#1e293b',
          750: '#172033',
          800: '#0f172a',
          850: '#0b1120',
          900: '#070b14',
          950: '#04070e',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(16, 185, 129, 0.25)',
        'glow': '0 0 25px -3px rgba(16, 185, 129, 0.35)',
        'glow-lg': '0 0 40px -5px rgba(16, 185, 129, 0.45)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
        'premium': '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
