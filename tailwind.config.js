/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
      },
      dropShadow: {
        glow: '0 0 25px rgba(99, 102, 241, 0.45)',
      },
    },
  },
  plugins: [],
}
