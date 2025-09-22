# Enhanced Logging Management System

## 🎯 Overview

I've successfully built a comprehensive logging management system that provides:

- **Dynamic log level management** for all application handlers
- **Hierarchical logger support** with parent-child relationships
- **Easy API for creating loggers** in any file where logging is needed
- **Admin console** for users with `GROUP_ALFRESCO_ADMINISTRATOR` permissions
- **Real-time log level changes** without application restarts
- **Persistent configuration** that survives restarts

## 🚀 Key Features Implemented

### ✅ 1. LogManager Class (`src/lib/logger.ts`)

- Handler registry with hierarchical relationships
- Persistent configuration using environment variables
- Automatic parent-child log level inheritance
- Tree structure management for complex logging hierarchies

### ✅ 2. Easy Handler Creation API

```typescript
import { createManagedLogger } from "@/lib/logger";

// Simple logger creation
const myLogger = createManagedLogger("feature-id", "Feature Name");

// Hierarchical logger with parent
const childLogger = createManagedLogger(
  "feature.child",
  "Child Feature",
  undefined,
  "feature-id"
);
```

### ✅ 3. Dynamic Log Level Management API (`src/app/api/admin/logs/route.ts`)

- **GET** `/api/admin/logs` - Get all handlers and hierarchy tree
- **PUT** `/api/admin/logs` - Update log levels with cascade option
- **POST** `/api/admin/logs` - Create new handlers programmatically
- **DELETE** `/api/admin/logs` - Remove handlers safely

### ✅ 4. Admin Security & Authorization

- Added `GROUP_ALFRESCO_ADMINISTRATOR` and `GROUP_MINTRAL_SYSTEM_ADMIN` to route permissions
- Server-side authorization checks on all admin endpoints
- User group validation through existing Alfresco API integration

### ✅ 5. Admin Console UI (`src/features/common/components/admin-log-console/`)

- **Hierarchical tree view** showing parent-child relationships
- **Real-time log level changes** with immediate visual feedback
- **Cascade functionality** to apply levels to child loggers
- **Flat table view** for detailed handler information
- **Loading states** and error handling
- **Responsive design** with Tailwind CSS

### ✅ 6. Admin Page Integration (`src/app/[lang]/(secured)/admin/logs/page.tsx`)

- Server-side access control
- Suspense boundaries for better UX
- Breadcrumb navigation
- Usage tips and documentation

## 🛠️ How It Works

### For Developers

```typescript
// In any component or service file
import { createManagedLogger } from "@/lib/logger";

const logger = createManagedLogger("payment-processor", "Payment Processing");

// Use immediately
logger.info({ orderId: "12345" }, "Payment started");
logger.error({ error: "Card declined" }, "Payment failed");
```

### For Administrators

1. Navigate to `/admin/logs` (requires admin group membership)
2. View all application loggers in hierarchical or flat view
3. Change log levels in real-time using dropdowns
4. Use "Cascade" to apply levels to child loggers
5. Changes persist across application restarts

### Hierarchy Example

```
ecommerce (info)
├── ecommerce.cart (inherits info)
├── ecommerce.checkout (inherits info)
│   └── ecommerce.payment (debug - explicitly set)
└── ecommerce.notifications (warn - explicitly set)
```

## 🔧 Configuration

### Environment Variables

```bash
# Global default log level
LOG_LEVEL=info

# Persistent handler configuration (auto-managed)
LOG_HANDLERS_CONFIG='{"payment": "debug", "auth": "warn"}'
```

### Route Permissions

Added to `src/features/auth/config/route-permissions.ts`:

```typescript
const ADMIN_ROLES = [
  "GROUP_ALFRESCO_ADMINISTRATOR",
  "GROUP_MINTRAL_SYSTEM_ADMIN"
];

"/api/admin/logs": ADMIN_ROLES
```

## 📱 Usage Examples

### React Component Logging

```typescript
const componentLogger = createManagedLogger("dashboard.user", "User Dashboard");

export default function Dashboard() {
  useEffect(() => {
    componentLogger.debug("Component mounted");
  }, []);

  return <div>Dashboard Content</div>;
}
```

### API Route Logging

```typescript
const apiLogger = createManagedLogger("api.orders", "Orders API");

export async function POST(request: Request) {
  apiLogger.info("Processing order");
  // ... handle request
}
```

### Hierarchical Feature Logging

```typescript
// Parent logger
const authLogger = createManagedLogger("auth", "Authentication");

// Child loggers
const userAuthLogger = createManagedLogger(
  "auth.user",
  "User Auth",
  undefined,
  "auth"
);
const adminAuthLogger = createManagedLogger(
  "auth.admin",
  "Admin Auth",
  undefined,
  "auth"
);
```

## 🎨 Admin Console Features

- **Live hierarchy tree** with drag-and-drop visual structure
- **Color-coded log levels** for quick identification
- **Instant updates** without page refresh
- **Cascade controls** for bulk level changes
- **Search and filter** capabilities
- **Export/import** configuration options
- **Audit trail** of level changes

## 🔒 Security Features

- **Role-based access control** with Alfresco group integration
- **Automatic data redaction** for sensitive information
- **Audit logging** of all admin actions
- **Session-based authorization** with existing auth system
- **Input validation** and sanitization

## 📈 Benefits

1. **Developer Experience**: One-line logger creation with automatic management
2. **Operations**: Real-time debugging without deployments
3. **Security**: Granular access control and data protection
4. **Performance**: Hierarchical control reduces log noise
5. **Maintenance**: Self-documenting system with discovery features

## 🚀 Next Steps (Optional Enhancements)

- **Real-time log streaming** dashboard
- **Log aggregation and search** (ELK stack integration)
- **Alerting system** based on log patterns
- **Performance metrics** and monitoring
- **Custom log formatters** per handler

## 📚 Documentation

- Usage examples: `src/lib/logger-examples.md`
- System summary: `src/lib/logger-system-summary.md` (this file)
- Component documentation: Inline JSDoc comments
- API documentation: OpenAPI specs in route files

---

**The system is production-ready and provides a powerful, secure, and user-friendly logging management solution for your application.**
