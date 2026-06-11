export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        g: {
          900: '#0F2318', 800: '#1A3A2A', 700: '#225038',
          600: '#2D6B4A', 400: '#4A9E72', 200: '#9ED4B8',
          100: '#CBF0DC', 50: '#EDFAF3',
        },
        gold: { DEFAULT: '#C9A84C', light: '#F5E8C0', dark: '#9A7530' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
