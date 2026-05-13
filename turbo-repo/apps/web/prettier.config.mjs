/** @type {import('prettier').Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindAttributes: ["theme"],
  tailwindFunctions: ["twMerge", "createTheme"],
};

export default config;
