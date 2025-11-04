import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: undefined, // Vercelで自動検出
  distDir: '.next',
  // Edge Runtimeエラーを回避するため、外部パッケージを設定
  serverExternalPackages: ['@supabase/supabase-js'],
  /* config options here */
}

export default nextConfig

