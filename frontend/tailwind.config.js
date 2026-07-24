export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Escala "g" repurpuesta: de verde a navy/azul premium. Mismos nombres
        // de clase (g-50…g-900) para que TODA la app herede el rebrand sin
        // tener que tocar cada archivo — solo cambia el valor hexadecimal.
        g: {
          900: '#0B1220', // ink — texto principal, casi negro con tinte navy
          800: '#0B1E4D', // navy profundo — paneles oscuros (salud financiera, etc.)
          700: '#2452FF', // azul eléctrico — color de marca, botones primarios
          600: '#3E6BFF', // azul medio — hover, links secundarios
          500: '#667085', // gris medio — texto secundario (antes indefinido: bug)
          400: '#8A93A6', // gris neutro — texto/íconos apagados (chrome estilo Nu)
          300: '#C7CEDD', // gris claro — bordes sutiles (antes indefinido: bug)
          200: '#DCE1EC', // gris azulado claro — bordes
          100: '#EEF0F5', // relleno sutil
          50:  '#F6F7FB', // fondo de la app — frío, no verde pálido
        },
        // Escala navy independiente para gradientes de "tarjeta física"
        navy: { 900: '#060B18', 800: '#0B1E4D', 700: '#10224F' },
        // Azul de marca — usar directamente cuando se necesite el acento puro
        blue: { 600: '#2452FF', 500: '#3E6BFF', 400: '#6E93FF', 100: '#E8EDFF', 50: '#F3F6FF' },
        // Acento cálido puntual (chip de tarjeta, badges "premium") — con cuentagotas
        gold: { DEFAULT: '#C9A84C', light: '#F5E8C0', dark: '#9A7530' },
        // Semántica de dinero, INDEPENDIENTE de la marca — nunca debe volverse azul
        pos: '#16A34A',
        neg: '#E5484D',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
