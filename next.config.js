/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // On desactive la verification ESLint pendant le build (souvent cause de "Build Failed"
    // quand eslint n'est pas installe/configure dans le projet)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
