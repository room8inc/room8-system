import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Room8 カラーパレット - 「自然×無骨さ」の融合
        room: {
          main: '#3a533a',        // メイン：現在の緑
          base: '#f5f5f0',        // ベース：オフホワイト/ライトグレー
          charcoal: '#2a2a2a',    // アクセント1：ダークチャコール/黒（インダストリアル感）
          wood: '#8b6f47',        // アクセント2：木目のブラウン（モンキーポッド）
          brass: '#b8935e',       // 差し色：ゴールド/真鍮色（金属パーツのイメージ）
          // バリエーション
          'main-light': '#4a634a',
          'main-dark': '#2a3a2a',
          'base-light': '#fafafa',
          'base-dark': '#e8e8e3',
          'charcoal-light': '#3a3a3a',
          'wood-light': '#a68a6a',
          'wood-dark': '#6b5535',
          'brass-light': '#c9a87e',
          'brass-dark': '#9d7a4e',
        },
      },
    },
  },
  plugins: [],
};
export default config;

