/** Tailwind build config — สร้าง css/app.css ด้วย: npm run build:css */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef7f1', 100: '#d5ecdd', 200: '#a9d6b9', 500: '#2f8a57', 600: '#1f6f43', 700: '#185a36', 800: '#124429', 900: '#0c2f1c' },
        ink: { DEFAULT: '#17231c', soft: '#4a5a51', mute: '#7a8a81' },
        paper: '#f3f5f4',
        line: '#dfe6e2',
        boundary: '#5b6b7f'
      },
      fontFamily: { sans: ['"IBM Plex Sans Thai"', 'Sarabun', 'system-ui', 'sans-serif'] },
      boxShadow: { panel: '0 1px 2px rgba(12,47,28,.06), 0 8px 24px -12px rgba(12,47,28,.18)' }
    }
  },
  plugins: []
};
