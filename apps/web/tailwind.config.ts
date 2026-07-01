import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        panel2: 'rgb(var(--panel2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        wash: 'rgb(var(--wash) / <alpha-value>)',
        ink: 'rgb(var(--fg) / <alpha-value>)',
        gold: { DEFAULT: '#f5c542', soft: '#e8b339', deep: '#b8881f' },
        win: '#1eb866',
        lose: '#ec4651',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        gold: '0 8px 30px -10px rgba(245,197,66,0.45)',
        panel: '0 16px 40px -22px rgba(20,22,40,0.22)',
      },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        riseIn: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: '0.5', transform: 'scale(0.9)' }, '50%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        glowPulse: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.65' } },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        riseIn: 'riseIn 0.5s ease-out both',
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
        glowPulse: 'glowPulse 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
