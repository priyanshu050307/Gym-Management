/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gym: {
          dark: '#f8fafc',      // slate-50 (light base)
          darker: '#f1f5f9',    // slate-100 (light background)
          card: '#ffffff',      // white card background
          primary: '#4f46e5',   // indigo-600 (vivid primary)
          secondary: '#0f172a', // slate-900 (bold accent)
          accent: '#10b981',    // emerald-500
          text: '#0f172a',      // slate-900 (dark text)
          muted: '#475569',     // slate-600 (muted text)
        }
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
        'gradient-premium': 'linear-gradient(135deg, #4f46e5 0%, #0f172a 100%)',
      }
    },
  },
  plugins: [],
}
