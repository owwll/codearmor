/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        ui: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        elevated: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        dialog: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      colors: {
        armor: {
          primary: '#4F46E5',
          'primary-hover': '#4338CA',
          'primary-subtle': '#EEF2FF',
          'primary-border': '#C7D2FE',
          critical: '#DC2626',
          'critical-subtle': '#FEF2F2',
          'critical-border': '#FECACA',
          warning: '#D97706',
          'warning-subtle': '#FFFBEB',
          'warning-border': '#FDE68A',
          success: '#059669',
          'success-subtle': '#ECFDF5',
          'success-border': '#A7F3D0',
          info: '#0284C7',
          'info-subtle': '#F0F9FF',
          'info-border': '#BAE6FD',
        },
      },
    },
  },
  plugins: [],
};
