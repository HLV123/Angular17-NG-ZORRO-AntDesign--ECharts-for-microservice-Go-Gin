/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#1e6fd9', 600: '#1a5fb8', 700: '#1d4ed8', 800: '#1e40af', 900: '#0f2a5e' },
        accent: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f07b21', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
        factory: { dark: '#0d1b2a', panel: '#1b2838', surface: '#1e293b' }
      }
    }
  },
  plugins: []
}
