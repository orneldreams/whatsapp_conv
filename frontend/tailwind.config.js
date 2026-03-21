/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EDE9FF",
          100: "#DDD4FF",
          600: "#6C3FE8",
          700: "#5531BE"
        },
        theme: {
          bg: "var(--bg-primary)",
          surface: "var(--bg-surface)",
          border: "var(--border)",
          text1: "var(--text-primary)",
          text2: "var(--text-secondary)",
          sidebar: "var(--sidebar-bg)"
        }
      }
    }
  },
  plugins: []
};

