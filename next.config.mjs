/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        canvas: false,
      }
    }
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-node", "sharp"],
  },
}

export default nextConfig
