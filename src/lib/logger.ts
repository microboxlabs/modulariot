import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

// Define log levels
const logLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

export type LogLevel = keyof typeof logLevels;

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

// Handler registry for dynamic log management
interface LogHandler {
  id: string;
  name: string;
  logger: pino.Logger;
  level: LogLevel;
  parent?: string;
  children: Set<string>;
  created: Date;
  lastModified: Date;
}

class LogManager {
  private handlers = new Map<string, LogHandler>();
  private persistentConfig = new Map<string, LogLevel>();

  constructor() {
    // Load any persistent configuration
    this.loadPersistedConfig();
  }

  private loadPersistedConfig() {
    // In a real app, this could load from database or config files
    // For now, we'll just use environment variables for persistence
    const configStr = process.env.LOG_HANDLERS_CONFIG;
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        Object.entries(config).forEach(([id, level]) => {
          this.persistentConfig.set(id, level as LogLevel);
        });
      } catch (error) {
        console.warn("Failed to parse LOG_HANDLERS_CONFIG:", error);
      }
    }
  }

  private savePersistedConfig() {
    const config = Object.fromEntries(this.persistentConfig);
    process.env.LOG_HANDLERS_CONFIG = JSON.stringify(config);
    // In production, you might want to save this to a database or config service
  }

  /**
   * Register a new log handler
   */
  registerHandler(
    id: string,
    name: string,
    initialLevel?: LogLevel,
    parent?: string
  ): pino.Logger {
    if (this.handlers.has(id)) {
      return this.handlers.get(id)!.logger;
    }

    // Get level from: 1) parameter, 2) persistent config, 3) parent, 4) default
    let level: LogLevel =
      initialLevel || this.persistentConfig.get(id) || getLogLevel();

    if (parent && this.handlers.has(parent)) {
      const parentHandler = this.handlers.get(parent)!;
      parentHandler.children.add(id);
      // If no explicit level set, inherit from parent
      if (!initialLevel && !this.persistentConfig.has(id)) {
        level = parentHandler.level;
      }
    }

    const logger = createLogger(name).child({ handlerId: id });
    logger.level = level;

    const handler: LogHandler = {
      id,
      name,
      logger,
      level,
      parent,
      children: new Set(),
      created: new Date(),
      lastModified: new Date(),
    };

    this.handlers.set(id, handler);
    return logger;
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): Array<{
    id: string;
    name: string;
    level: LogLevel;
    parent?: string;
    children: string[];
    created: string;
    lastModified: string;
  }> {
    return Array.from(this.handlers.values()).map((handler) => ({
      id: handler.id,
      name: handler.name,
      level: handler.level,
      parent: handler.parent,
      children: Array.from(handler.children),
      created: handler.created.toISOString(),
      lastModified: handler.lastModified.toISOString(),
    }));
  }

  /**
   * Update log level for a handler and optionally its children
   */
  setLogLevel(
    handlerId: string,
    level: LogLevel,
    cascadeToChildren = false
  ): boolean {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      return false;
    }

    handler.level = level;
    handler.logger.level = level;
    handler.lastModified = new Date();

    // Persist the configuration
    this.persistentConfig.set(handlerId, level);
    this.savePersistedConfig();

    // Optionally cascade to children
    if (cascadeToChildren) {
      handler.children.forEach((childId) => {
        this.setLogLevel(childId, level, true);
      });
    }

    return true;
  }

  /**
   * Get a handler by ID
   */
  getHandler(id: string): pino.Logger | undefined {
    return this.handlers.get(id)?.logger;
  }

  /**
   * Get handler hierarchy tree
   */
  getHandlerTree(): any {
    const tree: any = {};

    // First, add all root handlers (no parent)
    this.handlers.forEach((handler) => {
      if (!handler.parent) {
        tree[handler.id] = {
          id: handler.id,
          name: handler.name,
          level: handler.level,
          children: {},
        };
      }
    });

    // Then add children recursively
    const addChildren = (parentId: string, parentNode: any) => {
      const parent = this.handlers.get(parentId);
      if (parent) {
        parent.children.forEach((childId) => {
          const child = this.handlers.get(childId);
          if (child) {
            parentNode.children[childId] = {
              id: child.id,
              name: child.name,
              level: child.level,
              children: {},
            };
            addChildren(childId, parentNode.children[childId]);
          }
        });
      }
    };

    Object.keys(tree).forEach((rootId) => {
      addChildren(rootId, tree[rootId]);
    });

    return tree;
  }

  /**
   * Remove a handler
   */
  removeHandler(id: string): boolean {
    const handler = this.handlers.get(id);
    if (!handler) {
      return false;
    }

    // Remove from parent's children
    if (handler.parent) {
      const parent = this.handlers.get(handler.parent);
      if (parent) {
        parent.children.delete(id);
      }
    }

    // Move children to parent or make them orphans
    handler.children.forEach((childId) => {
      const child = this.handlers.get(childId);
      if (child) {
        child.parent = handler.parent;
        if (handler.parent) {
          const parent = this.handlers.get(handler.parent);
          if (parent) {
            parent.children.add(childId);
          }
        }
      }
    });

    this.handlers.delete(id);
    this.persistentConfig.delete(id);
    this.savePersistedConfig();
    return true;
  }
}

// Global log manager instance
const logManager = new LogManager();

// Create base logger configuration
const createLoggerConfig = () => {
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
      // Disable pretty transport to avoid worker thread issues
      // transport: {
      //   target: "pino-pretty",
      //   options: {
      //     colorize: true,
      //     translateTime: "SYS:standard",
      //     ignore: "pid,hostname",
      //     // messageFormat: "{msg} {req.method} {req.url} {responseTime}ms",
      //   },
      // },
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

// Easy API for creating managed log handlers
export const createManagedLogger = (
  id: string,
  name: string,
  initialLevel?: LogLevel,
  parent?: string
): pino.Logger => {
  return logManager.registerHandler(id, name, initialLevel, parent);
};

// Export commonly used loggers (now managed)
export const authLogger = createManagedLogger("auth", "auth");
export const apiLogger = createManagedLogger("api", "api");
export const dbLogger = createManagedLogger("database", "database");
export const mapLogger = createManagedLogger("map", "map");
export const taskLogger = createManagedLogger("task", "task");
export const userLogger = createManagedLogger("user", "user");
export const notificationLogger = createManagedLogger(
  "notification",
  "notification"
);

// Utility functions for structured logging
export const logError = (error: Error, context?: Record<string, any>) => {
  // if (isDevelopment) {
  //   console.error({ err: error, ...context }, error);
  // }
  logger.error({ err: error, ...context }, error.message);
};

export const logRequest = (req: any, res: any, responseTime?: number) => {
  logger.info(
    {
      req,
      res,
      responseTime,
    },
    `${req.method} ${req.url}`
  );
};

export const logApiCall = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  context?: Record<string, any>
) => {
  apiLogger.info(
    {
      method,
      url,
      statusCode,
      responseTime,
      ...context,
    },
    `API ${method} ${url} - ${statusCode} (${responseTime}ms)`
  );
};

// Log Management API - for admin interfaces
export const logManagementAPI = {
  /**
   * Get all registered log handlers
   */
  getAllHandlers: () => logManager.getAllHandlers(),

  /**
   * Get handler hierarchy tree
   */
  getHandlerTree: () => logManager.getHandlerTree(),

  /**
   * Set log level for a specific handler
   */
  setLogLevel: (
    handlerId: string,
    level: LogLevel,
    cascadeToChildren = false
  ) => logManager.setLogLevel(handlerId, level, cascadeToChildren),

  /**
   * Get a specific handler
   */
  getHandler: (id: string) => logManager.getHandler(id),

  /**
   * Remove a handler
   */
  removeHandler: (id: string) => logManager.removeHandler(id),

  /**
   * Register a new handler programmatically
   */
  registerHandler: (
    id: string,
    name: string,
    level?: LogLevel,
    parent?: string
  ) => logManager.registerHandler(id, name, level, parent),
};

// Export types for better TypeScript support
export type Logger = typeof logger;

// Helper type for log management interfaces
export interface LogHandlerInfo {
  id: string;
  name: string;
  level: LogLevel;
  parent?: string;
  children: string[];
  created: string;
  lastModified: string;
}
