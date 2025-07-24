# Pino Logging Implementation

This document describes the implementation of Pino logging in the Next.js project, replacing all `console.log` statements with proper structured logging.

## Overview

The implementation includes:
- **Pino Logger**: High-performance Node.js logger
- **Pino HTTP**: HTTP request/response logging middleware
- **Structured Logging**: JSON-formatted logs with context
- **Environment-based Configuration**: Different log levels for dev/prod/test
- **Security**: Automatic redaction of sensitive data
- **Context-specific Loggers**: Specialized loggers for different parts of the application

## Installation

The following packages have been installed:
```bash
npm install pino pino-http pino-pretty @types/pino
```

## Configuration

### Environment Variables

Add these to your `.env` file:
```env
# Log level (fatal, error, warn, info, debug, trace)
LOG_LEVEL=info

# Node environment (development, production, test)
NODE_ENV=development
```

### Log Levels by Environment

- **Development**: `debug` (shows all logs with pretty formatting)
- **Production**: `info` (JSON format, no sensitive data)
- **Test**: `warn` (minimal logging)

## Usage

### Basic Logging

```typescript
import { logger } from "@/lib/logger";

// Basic logging
logger.info("User logged in successfully");
logger.warn("API rate limit approaching");
logger.error("Database connection failed");

// Structured logging
logger.info({
  userId: "123",
  action: "login",
  ip: "192.168.1.1",
}, "User authentication successful");
```

### Context-Specific Loggers

```typescript
import { 
  authLogger, 
  apiLogger, 
  mapLogger, 
  taskLogger,
  userLogger,
  notificationLogger 
} from "@/lib/logger";

// Authentication logging
authLogger.info({ userId: "123" }, "User authenticated");

// API logging
apiLogger.info({ endpoint: "/api/users", method: "GET" }, "API call successful");

// Map logging
mapLogger.debug({ coordinates: [lat, lng] }, "Map position updated");

// Task logging
taskLogger.info({ taskId: "456", status: "completed" }, "Task completed");

// User logging
userLogger.info({ userId: "123", action: "profile_update" }, "Profile updated");

// Notification logging
notificationLogger.info({ type: "email", recipient: "user@example.com" }, "Notification sent");
```

### Error Logging

```typescript
import { logError } from "@/lib/logger";

try {
  // Some operation that might fail
  await riskyOperation();
} catch (error) {
  logError(error as Error, {
    context: "user-operation",
    userId: "123",
    operation: "profile-update",
  });
}
```

### API Request Logging

```typescript
import { logApiCall } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Your API logic here
    const result = await someOperation();
    
    const responseTime = Date.now() - startTime;
    logApiCall("GET", request.url, 200, responseTime, {
      userId: "123",
      operation: "fetch-data",
    });
    
    return NextResponse.json(result);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logError(error as Error, {
      method: "GET",
      url: request.url,
      responseTime,
    });
    
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

## Replacing Console.log Statements

### Option 1: Direct Replacement

Replace `console.log` with appropriate logger calls:

```typescript
// Before
console.log("User data:", userData);
console.error("API error:", error);

// After
logger.info({ userData }, "User data retrieved");
logger.error({ err: error }, "API error occurred");
```

### Option 2: Context-Specific Replacement

```typescript
// Before
console.log("Map position updated:", position);

// After
mapLogger.info({ position }, "Map position updated");
```

### Option 3: Global Console Replacement (Use with Caution)

```typescript
import { replaceConsoleGlobally } from "@/lib/console-replacer";

// Replace all console methods globally
replaceConsoleGlobally();
```

## Middleware Integration

The middleware automatically logs all HTTP requests and responses:

```typescript
// src/middleware.ts
import { logger } from "@/lib/logger";

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info({
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers.get("user-agent"),
  }, `Incoming request: ${request.method} ${request.url}`);

  const response = NextResponse.next();
  
  // Log response
  const responseTime = Date.now() - startTime;
  logger.info({
    method: request.method,
    url: request.url,
    statusCode: response.status,
    responseTime,
  }, `Request completed: ${request.method} ${request.url} - ${response.status} (${responseTime}ms)`);

  return response;
}
```

## Security Features

### Automatic Redaction

The logger automatically redacts sensitive information:
- Passwords
- Tokens
- Authorization headers
- Cookies
- API keys
- Secrets

### Custom Redaction

```typescript
// Add custom redaction paths
const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "user.creditCard",
      "apiKey",
    ],
    remove: true,
  },
});
```

## Development vs Production

### Development (Pretty Format)
```
[12:34:56.789] INFO: User logged in successfully
[12:34:57.123] WARN: API rate limit approaching
[12:34:58.456] ERROR: Database connection failed
```

### Production (JSON Format)
```json
{
  "level": 30,
  "time": 1640992496789,
  "pid": 12345,
  "hostname": "server-1",
  "msg": "User logged in successfully",
  "userId": "123",
  "ip": "192.168.1.1"
}
```

## Migration Guide

### Step 1: Replace Console.log in API Routes

```typescript
// Before
export async function GET(request: NextRequest) {
  console.log("API called:", request.url);
  // ...
}

// After
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  apiLogger.info({ url: request.url }, "API endpoint called");
  // ...
}
```

### Step 2: Replace Console.log in Components

```typescript
// Before
useEffect(() => {
  console.log("Component mounted");
}, []);

// After
import { logger } from "@/lib/logger";

useEffect(() => {
  logger.info("Component mounted");
}, []);
```

### Step 3: Replace Console.error

```typescript
// Before
try {
  await someOperation();
} catch (error) {
  console.error("Operation failed:", error);
}

// After
import { logError } from "@/lib/logger";

try {
  await someOperation();
} catch (error) {
  logError(error as Error, { operation: "someOperation" });
}
```

## Best Practices

1. **Use Context-Specific Loggers**: Use `authLogger`, `apiLogger`, etc., for better organization
2. **Structured Logging**: Always pass objects for additional context
3. **Error Logging**: Use `logError` for consistent error logging
4. **Performance**: Log at appropriate levels (debug for development, info for production)
5. **Security**: Never log sensitive information
6. **Request Tracking**: Include request IDs for tracing

## Monitoring and Analysis

### Log Aggregation
- Use tools like ELK Stack, Datadog, or Splunk
- Configure log shipping to central repository
- Set up alerts for error rates

### Performance Monitoring
- Monitor log volume and performance impact
- Use log levels appropriately to control verbosity
- Consider log rotation and retention policies

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check LOG_LEVEL environment variable
2. **Performance issues**: Reduce log level in production
3. **Sensitive data in logs**: Verify redaction configuration
4. **Memory leaks**: Ensure proper logger cleanup

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

This will show all logs with pretty formatting for easier debugging. 