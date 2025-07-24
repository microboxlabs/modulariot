import { logger, createLogger } from "./logger";

// Create a console replacement that uses Pino
export const consoleReplacer = {
  log: (...args: any[]) => {
    logger.info({ args }, "Console log");
  },
  info: (...args: any[]) => {
    logger.info({ args }, "Console info");
  },
  warn: (...args: any[]) => {
    logger.warn({ args }, "Console warning");
  },
  error: (...args: any[]) => {
    logger.error({ args }, "Console error");
  },
  debug: (...args: any[]) => {
    logger.debug({ args }, "Console debug");
  },
  trace: (...args: any[]) => {
    logger.trace({ args }, "Console trace");
  },
};

// Function to replace console methods globally (use with caution)
export const replaceConsoleGlobally = () => {
  if (typeof window !== "undefined") {
    // Client-side replacement
    Object.assign(console, consoleReplacer);
  } else {
    // Server-side replacement
    Object.assign(console, consoleReplacer);
  }
};

// Create context-specific console replacements
export const createContextConsole = (context: string) => {
  const contextLogger = createLogger(context);

  return {
    log: (...args: any[]) => {
      contextLogger.info({ args }, "Console log");
    },
    info: (...args: any[]) => {
      contextLogger.info({ args }, "Console info");
    },
    warn: (...args: any[]) => {
      contextLogger.warn({ args }, "Console warning");
    },
    error: (...args: any[]) => {
      contextLogger.error({ args }, "Console error");
    },
    debug: (...args: any[]) => {
      contextLogger.debug({ args }, "Console debug");
    },
    trace: (...args: any[]) => {
      contextLogger.trace({ args }, "Console trace");
    },
  };
};

// Export context-specific console replacements
export const authConsole = createContextConsole("auth");
export const apiConsole = createContextConsole("api");
export const mapConsole = createContextConsole("map");
export const taskConsole = createContextConsole("task");
export const userConsole = createContextConsole("user");
export const notificationConsole = createContextConsole("notification");
