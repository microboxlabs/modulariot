import pino from "pino";

// Define log levels
const logLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

// Get log level from environment or default to 'info'
const getLogLevel = (): keyof typeof logLevels => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in logLevels) {
    return envLevel as keyof typeof logLevels;
  }

  // Default levels based on environment
  if (process.env.NODE_ENV === "development") {
    return "debug";
  }
  if (process.env.NODE_ENV === "test") {
    return "warn";
  }
  return "info";
};

// Create base logger configuration
const createLoggerConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development";

  const baseConfig = {
    level: getLogLevel(),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (object: any) => {
        // Remove sensitive information from logs
        const {
          password: _password,
          token: _token,
          authorization: _authorization,
          ...safeObject
        } = object;
        return safeObject;
      },
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.token",
        'res.headers["set-cookie"]',
        "password",
        "token",
        "authorization",
        "secret",
        "key",
      ],
      remove: true,
    },
  };

  // Development configuration with pretty printing
  if (isDevelopment) {
    return {
      ...baseConfig,
      /* transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
          messageFormat: "{msg} {req.method} {req.url} {responseTime}ms",
        },
      }, */
    };
  }

  // Production configuration (JSON format)
  return baseConfig;
};

// Create the main logger instance
export const logger = pino(createLoggerConfig());

// Create specialized loggers for different contexts
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Export commonly used loggers
export const authLogger = createLogger("auth");
export const apiLogger = createLogger("api");
export const dbLogger = createLogger("database");
export const mapLogger = createLogger("map");
export const taskLogger = createLogger("task");
export const userLogger = createLogger("user");
export const notificationLogger = createLogger("notification");

// Utility functions for structured logging
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error({ err: error, ...context }, error.message);
};

export const logRequest = (req: any, res: any, responseTime?: number) => {
  logger.info(
    {
      req,
      res,
      responseTime,
    },
    `${req.method} ${req.url}`,
  );
};

export const logApiCall = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  context?: Record<string, any>,
) => {
  apiLogger.info(
    {
      method,
      url,
      statusCode,
      responseTime,
      ...context,
    },
    `API ${method} ${url} - ${statusCode} (${responseTime}ms)`,
  );
};

// Export types for better TypeScript support
export type Logger = typeof logger;
export type LogLevel = keyof typeof logLevels;
