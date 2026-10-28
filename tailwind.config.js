/** @type {import('tailwindcss').Config} */
// Theme clair/sombre : les familles de couleurs ci-dessous pointent vers des variables CSS
// (definies dans app/globals.css). Sombre = valeurs d'origine (bleu actuel), jour = creme/blanc.
const colors = require('tailwindcss/colors')

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const themed = (family) =>
  Object.fromEntries(shades.map((s) => [s, `rgb(var(--c-${family}-${s}) / <alpha-value>)`]))

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: themed('slate'),
        red: { ...colors.red, ...themed('red') },
        amber: { ...colors.amber, ...themed('amber') },
        green: { ...colors.green, ...themed('green') },
        emerald: { ...colors.emerald, ...themed('emerald') },
        indigo: { ...colors.indigo, ...themed('indigo') },
        sky: { ...colors.sky, ...themed('sky') },
        white: 'rgb(var(--c-white) / <alpha-value>)',
        primary: '#1E3A8A',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        navy: '#0F2540',
        'navy-deep': '#0A1A2E',
        teal: '#1F6F78',
        'teal-light': '#E4F1F0',
        gold: '#F0CC7A',
        ink: '#101826',
        cream: '#F9ECE5',
        'deep-green': '#014B43',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Poppins', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
