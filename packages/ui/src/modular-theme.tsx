import { createTheme, ThemeProvider } from "flowbite-react";

export const modularTheme = createTheme({
  button: {
    color: {
    //   default: `bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-300 
    //   dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
    // default: `bg-blue-500 text-white hover:bg-blue-700 focus:ring-blue-300 
    // dark:bg-blue-600 dark:hover:bg-blue-200 dark:focus:ring-blue-800`😂😔😍❤️
    default: "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800",
    }
  },
});

export const ModularThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <ThemeProvider theme={modularTheme}>{children}</ThemeProvider>;
};