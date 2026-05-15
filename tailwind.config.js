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
      boxShadow: {
        'glow-primary': '0 0 20px rgba(124,58,237,0.25), 0 0 8px rgba(124,58,237,0.15)',
        'glow-accent':  '0 0 20px rgba(6,182,212,0.25), 0 0 8px rgba(6,182,212,0.15)',
        'glow-success': '0 0 20px rgba(74,222,128,0.25), 0 0 8px rgba(74,222,128,0.15)',
        'glow-card':    '0 4px 24px rgba(0,0,0,0.4)',
        'glow-hover':   '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(124,58,237,0.1)',
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(180deg, #0F0F1A 0%, #161628 100%)',
        'card-gradient':    'linear-gradient(135deg, #161628 0%, #1a1a2e 100%)',
      },
    },
  },
  plugins: [],
}
