import type { Config } from "tailwindcss";
import flowbite from "flowbite-react/tailwind";

// Common animation keyframe properties
const ANIMATION_PROPS = {
  HIDDEN: { opacity: "0", display: "none", maxHeight: "0" },
  VISIBLE_FLEX: { opacity: "1", display: "flex", maxHeight: "100%" },
  VISIBLE_INLINE: { opacity: "1", display: "inline", maxHeight: "100%" },
  HALF_HIDDEN: { opacity: "0", display: "none", maxHeight: "50%" },
  SCALE_HIDDEN: { opacity: "0", width: "0", scale: "0" },
  SCALE_VISIBLE: { opacity: "1", width: "100%", scale: "1" },
};

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
        "orbit": "orbit 5s linear infinite",
        "orbit-2": "orbit-2 6s linear infinite",
        "fade-in": "fade-in 5s ease-in-out forwards",
        "fade-in-fast": "fade-in 0.2s ease-in-out forwards",
        "fade-out": "fade-out 5s ease-in-out forwards",
        "fade-out-fast": "fade-out 0.2s ease-in-out forwards",
        "hide-flex": "hide-flex 0.2s ease-in-out forwards",
        "show-flex-middle": "show-flex-middle 0.2s ease-in-out forwards",
        "hide-flex-middle": "hide-flex-middle 0.2s ease-in-out forwards",
        "hide-scale": "hide-scale 0.2s ease-in-out forwards",
        "show-scale": "show-scale 0.2s ease-in-out forwards",
      },
      keyframes: {
        "hide-scale": {
          "0%": ANIMATION_PROPS.SCALE_VISIBLE,
          "50%": ANIMATION_PROPS.SCALE_HIDDEN,
          "100%": { ...ANIMATION_PROPS.SCALE_HIDDEN, display: "none" },
        },
        "show-scale": {
          "0%": { ...ANIMATION_PROPS.SCALE_HIDDEN, display: "flex" },
          "50%": ANIMATION_PROPS.SCALE_HIDDEN,
          "100%": ANIMATION_PROPS.SCALE_VISIBLE,
        },
        "hide": {
          "0%": ANIMATION_PROPS.VISIBLE_INLINE,
          "50%": ANIMATION_PROPS.HALF_HIDDEN,
          "100%": ANIMATION_PROPS.HIDDEN,
        },
        "hide-flex": {
          "0%": ANIMATION_PROPS.VISIBLE_FLEX,
          "100%": ANIMATION_PROPS.HIDDEN,
        },
        "hide-flex-middle": {
          "0%": ANIMATION_PROPS.VISIBLE_FLEX,
          "50%": ANIMATION_PROPS.HALF_HIDDEN,
          "100%": ANIMATION_PROPS.HIDDEN,
        },
        "show-flex": {
          "0%": ANIMATION_PROPS.HIDDEN,
          "100%": ANIMATION_PROPS.VISIBLE_FLEX,
        },
        "show-flex-middle": {
          "0%": ANIMATION_PROPS.HIDDEN,
          "50%": ANIMATION_PROPS.HIDDEN,
          "100%": ANIMATION_PROPS.VISIBLE_FLEX,
        },
        "show": {
          "0%": ANIMATION_PROPS.HIDDEN,
          "100%": ANIMATION_PROPS.VISIBLE_INLINE,
        },
        "hide-width": {
          "0%": { opacity: "1", display: "flex", maxWidth: "100%" },
          "90%": { opacity: "0", display: "none", maxWidth: "100%" },
          "100%": { opacity: "0", display: "none", maxWidth: "0%" },
        },
        "shadow-toggle": {
          "0%": { boxShadow: "0 0 0 rgba(0,0,0,0)" },
          "100%": { boxShadow: "0px 0px 10px rgba(225, 29, 72, 0.6)" }, // add this as a rgba #E11D48
        },
        "orbit": {
          "0%": { transform: "rotate(0deg) translate(100px, 0px)" },
          "100%": { transform: "rotate(360deg) translate(100px, 0px)" },
        },
        "orbit-2": {
          "0%": { transform: "rotate(0deg) translate(150px, 0px)" },
          "100%": { transform: "rotate(360deg) translate(150px, 0px)" },
        },
        "fade-in": {
          "0%": { opacity: "0", display: "none" },
          "100%": { opacity: "1", display: "flex" },
        },
        "fade-out": {
          "0%": { opacity: "1", display: "flex" },
          "100%": { opacity: "0", display: "none" },
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
  safelist: [
    {
      pattern: /^no-dot$/,
      variants: ['hover', 'focus', 'active'],
    },
  ],
};
export default config;
