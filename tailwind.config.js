/**
 * 사랑은 돌아오는 거야 — 디자인 토큰
 * 밤하늘 네이비 배경 위에 달빛 골드와 피치 코랄이 얹히는 구성.
 * 야간 행사이므로 라이트 모드는 제공하지 않고 다크 톤으로 고정한다.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 유리질감 테두리에 쓰는 값. 기본 스케일에 없어 색상 슬래시 표기(/12)가
      // 동작하지 않으므로 여기에 추가한다.
      opacity: {
        12: '0.12',
        15: '0.15',
      },
      colors: {
        midnight: {
          DEFAULT: '#0B1026',
          900: '#070B1C',
          800: '#0B1026',
          700: '#121A3A',
          600: '#1B2A5B',
          500: '#26386F',
        },
        moonlight: {
          DEFAULT: '#FFD98E',
          soft: '#FFEFC7',
          deep: '#E5B85C',
        },
        peach: {
          DEFAULT: '#FFB3C1',
          soft: '#FFD6DE',
          deep: '#F07A93',
        },
        glow: {
          DEFAULT: '#7DD3FC',
          soft: '#BAE6FD',
          deep: '#38BDF8',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(255, 217, 142, 0.45)',
        'glow-peach': '0 0 40px -8px rgba(255, 179, 193, 0.45)',
        card: '0 18px 50px -20px rgba(0, 0, 0, 0.65)',
      },
      backgroundImage: {
        'night-sky': 'linear-gradient(180deg, #070B1C 0%, #0B1026 35%, #1B2A5B 100%)',
        'moon-gradient': 'linear-gradient(135deg, #FFD98E 0%, #FFB3C1 100%)',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.25', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        twinkle: 'twinkle 3.5s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
