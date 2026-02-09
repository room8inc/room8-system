import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: undefined, // Vercelで自動検出
  distDir: '.next',
  // Edge Runtimeエラーを回避するため、外部パッケージを設定
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // 💡 パフォーマンス最適化
  compress: true, // Gzip圧縮を有効化
  poweredByHeader: false, // X-Powered-By ヘッダーを削除（セキュリティ）
  
  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // 実験的機能
  experimental: {
    optimizePackageImports: ['@stripe/react-stripe-js', '@stripe/stripe-js'],
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    })
    return config
  },
}

export default nextConfig

