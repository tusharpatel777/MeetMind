/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e1e7ff',
          200: '#c8d4ff',
          300: '#a3b7ff',
          400: '#7991ff',
          500: '#4f62ff', // Main Brand Accent
          600: '#3843ff',
          700: '#262cd9',
          800: '#2024b0',
          900: '#1d218c',
          950: '#101254',
        },
        dark: {
          50: '#f6f6f7',
          100: '#eef0f2',
          200: '#dadfe5',
          300: '#b8c4d0',
          400: '#92a3b7',
          500: '#758aa1',
          600: '#5f7188',
          700: '#4e5b6e',
          800: '#434c5b',
          900: '#111827', // Pitch Dark background
          950: '#030712', // Pure Black secondary background
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
