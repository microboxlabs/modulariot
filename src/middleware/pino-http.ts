import pinoHttp from "pino-http";
import { logger } from "@/lib/logger";
import hexoid from "hexoid";

// Create Pino HTTP middleware
export const pinoHttpMiddleware = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return "warn";
    }
    if (res.statusCode >= 500 || err) {
      return "error";
    }
    if (res.statusCode >= 300 && res.statusCode < 400) {
      return "silent";
    }
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err?.message || "Unknown error"}`;
  },
  customAttributeKeys: {
    req: "request",
    res: "response",
    err: "error",
    responseTime: "responseTime",
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders(),
    }),
    err: (err) => ({
      type: err.type,
      message: err.message,
      stack: err.stack,
    }),
  },
  // Skip logging for health checks and static assets
  customProps: (req, _res) => {
    return {
      context: "http",
      userAgent: req.headers["user-agent"],
      remoteAddress: req.connection?.remoteAddress,
    };
  },
  // Custom request ID generation
  genReqId: (req) => {
    return req.headers["x-request-id"] || req.id || hexoid();
  },
});

// Export a simpler version for Next.js API routes
export const createPinoHttpLogger = () => {
  return pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return "warn";
      }
      if (res.statusCode >= 500 || err) {
        return "error";
      }
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          "user-agent": req.headers["user-agent"],
          "content-type": req.headers["content-type"],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
};
