/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E3A8A',
        accent: '#22C55E',
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
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
