# Auth Configuration Logger Integration

## 🎯 Overview

The authentication system has been successfully integrated with the enhanced managed logger system, providing hierarchical logging for all authentication flows with dynamic log level control.

## 🏗️ Logger Hierarchy

The auth system now uses a hierarchical logger structure:

```
auth (Authentication System)
├── auth.jwt (JWT Processing)
├── auth.session (Session Management)
├── auth.authorization (Route Authorization)
└── auth.providers (Auth Providers)
    ├── auth.providers.microsoft (Microsoft Entra ID)
    └── auth.providers.credentials (Credentials Auth)
```

## 📋 Implementation Details

### Logger Creation

```typescript
// Create hierarchical auth loggers for better management
const authLogger = createManagedLogger("auth", "Authentication System");
const authJwtLogger = createManagedLogger(
  "auth.jwt",
  "JWT Processing",
  undefined,
  "auth"
);
const authSessionLogger = createManagedLogger(
  "auth.session",
  "Session Management",
  undefined,
  "auth"
);
const authProviderLogger = createManagedLogger(
  "auth.providers",
  "Auth Providers",
  undefined,
  "auth"
);
const authMicrosoftLogger = createManagedLogger(
  "auth.providers.microsoft",
  "Microsoft Entra ID",
  undefined,
  "auth.providers"
);
const authCredentialsLogger = createManagedLogger(
  "auth.providers.credentials",
  "Credentials Auth",
  undefined,
  "auth.providers"
);
const authAuthzLogger = createManagedLogger(
  "auth.authorization",
  "Route Authorization",
  undefined,
  "auth"
);
```

### NextAuth Integration

#### Custom Logger Configuration

```typescript
logger: {
  error(error: Error) {
    authLogger.error("NextAuth Error", { error: error.message, stack: error.stack });
  },
  warn(code: string) {
    authLogger.warn("NextAuth Warning", { code });
  },
  debug(code: string, ...message: any[]) {
    authLogger.debug("NextAuth Debug", { code, message });
  },
}
```

#### Event Tracking

```typescript
events: {
  async signIn({ user, account, profile, isNewUser }) {
    if (account?.provider === "microsoft-entra-id") {
      authMicrosoftLogger.info("User signed in via Microsoft Entra ID", {
        userId: user.id,
        email: user.email,
        isNewUser,
      });
    } else if (account?.provider === "credentials") {
      authCredentialsLogger.info("User signed in via credentials", {
        userId: user.id,
        email: user.email,
        isNewUser,
      });
    }
  },
  async signOut(message) {
    const userId = 'session' in message ? (message.session as any)?.user?.id : message.token?.sub;
    authLogger.info("User signed out", {
      userId,
      timestamp: new Date().toISOString(),
    });
  },
  async session({ session, token }) {
    authSessionLogger.debug("Session accessed", {
      userId: session?.user?.id,
      expires: session?.expires,
    });
  },
}
```

## 🎛️ Admin Control Benefits

### Dynamic Log Level Management

Administrators with `GROUP_ALFRESCO_ADMINISTRATORS` can now:

1. **Control auth logging granularity** - Set different levels for different auth components
2. **Debug authentication issues** - Enable debug/trace for specific providers
3. **Monitor security events** - Set info/warn levels for production monitoring
4. **Cascade changes** - Apply log level changes to entire auth system or specific parts

### Example Admin Operations

#### Enable Debug for Microsoft Auth Only:

```bash
PUT /app/api/admin/logs
{
  "handlerId": "auth.providers.microsoft",
  "level": "debug"
}
```

#### Set All Auth to Warning Level (Production):

```bash
PUT /app/api/admin/logs
{
  "handlerId": "auth",
  "level": "warn",
  "cascadeToChildren": true
}
```

#### Enable Detailed JWT Debugging:

```bash
PUT /app/api/admin/logs
{
  "handlerId": "auth.jwt",
  "level": "trace"
}
```

## 📊 Logging Coverage

### Authorization Flow

- Route access attempts
- Authentication state checks
- Redirect decisions
- Success/failure tracking

### JWT Processing

- Token creation and validation
- Provider-specific token handling
- Token expiration and renewal
- Error handling

### Session Management

- Session creation and updates
- Token expiration handling
- OAuth vs credentials flow differences
- Session cleanup

### Provider-Specific Logging

- **Microsoft Entra ID**: OAuth flows, token exchange, profile processing
- **Credentials**: Username/password authentication, validation steps

## 🔧 Usage Examples

### For Developers

The logging happens automatically - no changes needed in your code. All auth events are now properly logged with structured data.

### For Administrators

1. Navigate to `/admin/logs`
2. Find the `auth` logger hierarchy
3. Adjust levels as needed:
   - **Production**: Set auth to `warn` or `info`
   - **Development**: Set auth to `debug` or `trace`
   - **Troubleshooting**: Enable `debug` for specific providers

### For Operations

Monitor auth-related logs with structured queries:

```bash
# Monitor failed logins
grep "error.*auth" logs.json

# Track Microsoft auth usage
grep "Microsoft Entra ID" logs.json

# Monitor session issues
grep "auth.session.*warn|error" logs.json
```

## 🚀 Benefits

1. **Granular Control**: Different log levels for different auth components
2. **Security Monitoring**: Structured logging for security events
3. **Performance Debugging**: Detailed timing and flow information
4. **Real-time Management**: No restarts needed for log level changes
5. **Hierarchical Organization**: Logical grouping of related auth components
6. **Production Ready**: Proper error handling and safe defaults

---

**The auth system now provides comprehensive, manageable logging that integrates seamlessly with your existing authentication flows while providing powerful admin control capabilities.**
