// frontend/postcss.config.js

module.exports = {
  plugins: [
    // 💡 배열 문법을 사용하여 플러그인을 명시합니다.
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};