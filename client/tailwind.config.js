/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        vault: {
          bg:     '#05060F',
          surface:'#0F1020',
          raised: '#161828',
          amber:  '#F5A623',
          teal:   '#00C9A7',
          red:    '#FF5C5C',
          purple: '#9B8AFB',
          blue:   '#5BA4F5',
          pink:   '#F472B6',
          text1:  '#EAEDF5',
          text2:  '#9295A8',
          text3:  '#4A4E65',
          border: 'rgba(255,255,255,0.07)',
        }
      },
      animation: {
        'flame': 'flame-flicker 2.2s ease-in-out infinite alternate',
        'logo-pulse': 'logo-pulse 3.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    }
  },
  plugins: []
}
