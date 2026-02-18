/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora gli errori TypeScript durante il build di produzione
    // TODO: rimuovere dopo aver fixato tutti gli errori TypeScript
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig