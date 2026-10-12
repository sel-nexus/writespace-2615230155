/** Map the source palette to reusable semantic colors. */
import colors from 'tailwindcss/colors';
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: colors.indigo,
        secondary: colors.violet,
        neutral: colors.slate,
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        foreground: colors.slate[800],
        muted: colors.slate[500],
        border: colors.slate[200],
        ring: colors.indigo[600],
        error: colors.red[600],
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Lora', 'serif'] },
    },
  },
  plugins: [],
};
