import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    // ui-tokens has no classNames, but keep the seam if tokens grow JSX later.
    '../../packages/ui-tokens/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: 'hsl(var(--success))',
        pink: {
          DEFAULT: '#FF3EA5',
          bright: '#FF4DA0',
          deep: '#FF1F7A',
        },
        'blue-accent': '#4F7CFF',
        glow2: '#C084FC',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': 'calc(var(--radius) + 6px)',
        '3xl': 'calc(var(--radius) + 12px)',
      },
      boxShadow: {
        glow: '0 0 24px -2px rgba(168, 85, 247, 0.45)',
        'glow-lg': '0 0 60px -6px rgba(168, 85, 247, 0.55)',
        'glow-soft': '0 8px 40px -12px rgba(124, 58, 237, 0.5)',
      },
      backdropBlur: {
        glass: '20px',
      },
      spacing: {
        // WCAG 2.2 minimum interactive target (SPEC §13 / @halfsaid/ui-tokens).
        touch: '44px',
        // High-load / motor-impaired target (@halfsaid/ui-tokens).
        'touch-lg': '64px',
      },
      keyframes: {
        breathe: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.045)' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'gradient-x': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        twinkle: {
          '0%,100%': { opacity: '0.15', transform: 'scale(0.85)' },
          '50%': { opacity: '0.9', transform: 'scale(1.1)' },
        },
        'wave-x': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(28px,-36px) scale(1.08)' },
          '66%': { transform: 'translate(-22px,20px) scale(0.94)' },
        },
      },
      animation: {
        breathe: 'breathe 5s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        twinkle: 'twinkle 4s ease-in-out infinite',
        'wave-x': 'wave-x 24s linear infinite',
        blob: 'blob 26s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
