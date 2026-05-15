/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:  '#7C3AED',
        surface:  '#0F0F1A',
        card:     '#161628',
        border:   '#1E1E35',
        accent:   '#06B6D4',
        success:  '#4ADE80',
        warning:  '#FBBF24',
        danger:   '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}