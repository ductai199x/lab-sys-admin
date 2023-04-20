/** @type {import('next').NextConfig} */
const defaultConfig = {
  reactStrictMode: true,
}

module.exports = (phase, { defaultConfig }) => {
  return {
    ...defaultConfig,

    webpack: (config, { isServer }) => {
      if (!isServer) {
          // don't resolve 'fs' module on the client to prevent this error on build --> Error: Can't resolve 'fs'
          config.resolve.fallback = {
              fs: false,
              module: false,
          }
      }

      return config;
    },
    modules: [
      'node_modules'
    ],
  }
}