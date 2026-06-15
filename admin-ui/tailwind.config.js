/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        armor: {
          primary: '#1a1f2e',
          accent: '#3b82f6',
          critical: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          success: '#10b981'
        }
      }
    }
  },
  plugins: []
}
