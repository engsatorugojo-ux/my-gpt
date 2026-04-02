export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#171717",
        main:    "#212121",
        input:   "#2f2f2f",
        border:  "#3a3a3a",
        accent:  "#10a37f",
        muted:   "#8e8ea0",
      },
    },
  },
  plugins: [],
  safelist: ["bg-white/8", "bg-white/5", "translate-x-0", "-translate-x-full"],
};
