/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        status: {
          normal: '#16A34A',
          active: '#2563EB',
          warning: '#EA580C',
          critical: '#DC2626',
          offline: '#64748B',
        },
      },
    },
  },
  plugins: [],
};
