import type { Config } from "tailwindcss";
import flowbite from "flowbite-react/tailwind";

const config: Config = {
  content: [
    "./node_modules/flowbite-react/lib/**/*.js",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./public/**/*.html",
    flowbite.content(),
  ],
  darkMode: "class", // This is important
  theme: {
    extend: {
      animation: {
        "shadow-toggle": "shadow-toggle 0.5s infinite alternate",
        "hide": "hide 0.2s ease-in-out forwards",
        "show": "show 0.2s ease-in-out forwards",
        "show-flex": "show-flex 0.2s ease-in-out forwards",
        "hide-width": "hide-width 0.2s ease-in-out forwards",
      },
      keyframes: {
        "hide": {
          "0%": { opacity: "1", display: "inline", maxHeight: "100%" },
          "50%": { opacity: "0", display: "none", maxHeight: "50%" },
          "100%": { opacity: "0", display: "none", maxHeight: "0" },
        },
        "show-flex": {
          "0%": { opacity: "0", display: "none", maxHeight: "0" },
          "100%": { opacity: "1", display: "flex", maxHeight: "100%" },
        },
        "show": {
          "0%": { opacity: "0", display: "none", maxHeight: "0" },
          "100%": { opacity: "1", display: "inline", maxHeight: "100%" },
        },
        "hide-width": {
          "0%": { opacity: "1", display: "flex", maxWidth: "100%" },
          "90%": { opacity: "0", display: "none", maxWidth: "100%" },
          "100%": { opacity: "0", display: "none", maxWidth: "0%" },
        },
        "show-flex": {
          "0%": { opacity: "0", display: "none", maxHeight: "0" },
          "100%": { opacity: "1", display: "flex", maxHeight: "100%" },
        },
        "shadow-toggle": {
          "0%": { boxShadow: "0 0 0 rgba(0,0,0,0)" },
          "100%": { boxShadow: "0px 0px 20px rgba(225, 29, 72, 0.6)" }, // add this as a rgba #E11D48
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    // ...
    flowbite.plugin(),
  ],
};
export default config;
