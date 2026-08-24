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
          800: '#0B1E4D', // navy profundo — paneles oscuros Y hover de botones
                          // (el azul se "asoma" solo un instante al interactuar)
          700: '#151B2E', // tinta casi negra — botones primarios, estados activos
          600: '#2B3348', // slate oscuro — hover/links secundarios (ya NO es azul)
          500: '#667085', // gris medio — texto secundario
          400: '#8A93A6', // gris neutro — texto/íconos apagados (chrome estilo Nu)
          300: '#C7CEDD', // gris claro — bordes sutiles
          200: '#DCE1EC', // gris azulado claro — bordes
          100: '#EEF0F5', // relleno sutil
          50:  '#F6F7FB', // fondo de la app
        },
        // Escala navy independiente para gradientes de "tarjeta física"
        navy: { 900: '#060B18', 800: '#0B1E4D', 700: '#10224F' },
        // Azul de marca — RESERVADO. Úsalo solo en el hero card y momentos
        // puntuales de énfasis (ej. indicador activo del nav). Nunca en
        // botones o filtros de uso frecuente — por eso dejó de estar en la
        // escala "g". Si el azul aparece en todos lados, deja de ser especial.
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
