import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['"Tajawal"', '"Cairo"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a8a',
          900: '#1e2d6b',
          950: '#0f172a',
        },
        water: {
          light: '#7dd3fc',
          mid: '#38bdf8',
          deep: '#0ea5e9',
        },
        // Modern accent colors
        neon: {
          blue: '#00d4ff',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#10b981',
          orange: '#f59e0b',
        },
        surface: {
          DEFAULT: '#0a0e1a',
          1: '#040812',
          2: '#0f1629',
          3: '#1a2240',
          4: '#243056',
        },
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'water-drop': 'waterDrop 1.5s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.6s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-soft': 'bounceSoft 2s ease-in-out infinite',
        'mesh-move': 'meshMove 20s ease infinite',
        'border-glow': 'borderGlow 3s ease infinite',
        'scale-in': 'scaleIn 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'counter': 'counter 2s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        waterDrop: {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
          '100%': { transform: 'scaleY(0)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        meshMove: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(30px, -30px) rotate(120deg)' },
          '66%': { transform: 'translate(-20px, 20px) rotate(240deg)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(59, 130, 246, 0.3)' },
          '50%': { borderColor: 'rgba(59, 130, 246, 0.6)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(30px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-30px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'water': '0 4px 30px rgba(56, 189, 248, 0.3)',
        'brand': '0 4px 30px rgba(37, 99, 235, 0.3)',
        'glow': '0 0 30px rgba(56, 189, 248, 0.5)',
        'glow-sm': '0 0 15px rgba(56, 189, 248, 0.3)',
        'glow-lg': '0 0 60px rgba(56, 189, 248, 0.4)',
        'neon-blue': '0 0 20px rgba(0, 212, 255, 0.4)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.06)',
        'card': '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
        'card-hover': '0 12px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(37,99,235,0.15)',
        'float': '0 20px 60px rgba(0,0,0,0.3)',
      },
      backdropBlur: {
        'xs': '2px',
        '3xl': '64px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-1': 'radial-gradient(at 40% 20%, hsla(228,80%,30%,0.4) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(200,80%,40%,0.3) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(260,80%,40%,0.3) 0px, transparent 50%)',
        'mesh-2': 'radial-gradient(at 0% 0%, hsla(228,80%,40%,0.5) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(200,80%,40%,0.3) 0px, transparent 50%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
