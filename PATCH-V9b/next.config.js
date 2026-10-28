/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/lead/:agency', destination: '/lead?a=:agency', permanent: false }]
  },
  eslint: {
    // On desactive la verification ESLint pendant le build (souvent cause de "Build Failed"
    // quand eslint n'est pas installe/configure dans le projet)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
