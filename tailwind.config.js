export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "modal-backdrop": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-panel": {
          from: { opacity: "0", transform: "scale(0.95) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "modal-backdrop": "modal-backdrop 0.2s ease forwards",
        "modal-panel": "modal-panel 0.25s ease forwards",
      },
    },
  },
};
