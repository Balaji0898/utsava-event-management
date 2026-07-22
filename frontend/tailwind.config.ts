import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './src/shared/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // "brand" is repurposed as the luxury GOLD palette so the entire
        // website + dashboard re-skin cohesively.
        brand: {
          50: '#FCF9F0',
          100: '#F7EFD8',
          200: '#EEDCA9',
          300: '#E3C877',
          400: '#D4AF37', // metallic gold
          500: '#C9A227',
          600: '#A9861F',
          700: '#856819',
          800: '#5F4A16',
          900: '#40320F',
        },
        champagne: '#F7EFD8',
        cream: '#FBF8F1',
        ink: '#141210',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #E3C877 0%, #D4AF37 45%, #A9861F 100%)',
        'hero-gradient':
          'radial-gradient(1200px 600px at 10% -10%, rgba(212,175,55,0.22), transparent), radial-gradient(1000px 500px at 90% 10%, rgba(227,200,119,0.18), transparent)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(20, 18, 16, 0.18)',
        gold: '0 10px 40px -10px rgba(212, 175, 55, 0.55)',
        luxe: '0 30px 60px -20px rgba(20, 18, 16, 0.35)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
