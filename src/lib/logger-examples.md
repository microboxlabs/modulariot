# Enhanced Logger System Usage Examples

## Easy Handler Creation API

### Basic Usage - Create a logger in any file where you need logging:

```typescript
import { createManagedLogger } from "@/lib/logger";

// Create a logger for a specific feature
const myFeatureLogger = createManagedLogger(
  "payment-processing",
  "Payment Processing"
);

// Use it immediately
myFeatureLogger.info("Payment initiated", { orderId: "12345", amount: 100 });
myFeatureLogger.error("Payment failed", { error: "Card declined" });
```

### Hierarchical Loggers - Create child loggers that inherit from parents:

```typescript
import { createManagedLogger } from "@/lib/logger";

// Create parent logger
const ecommerceLogger = createManagedLogger("ecommerce", "E-commerce");

// Create child loggers that inherit parent's log level
const cartLogger = createManagedLogger(
  "ecommerce.cart",
  "Shopping Cart",
  undefined,
  "ecommerce"
);
const checkoutLogger = createManagedLogger(
  "ecommerce.checkout",
  "Checkout",
  undefined,
  "ecommerce"
);
const paymentLogger = createManagedLogger(
  "ecommerce.payment",
  "Payment",
  undefined,
  "ecommerce.checkout"
);

// Now when admin changes ecommerce log level to "error", all children inherit it
// Unless they have been explicitly set to different levels
```

### In a React Component:

```typescript
"use client";

import { createManagedLogger } from "@/lib/logger";
import { useEffect } from "react";

const componentLogger = createManagedLogger("user-dashboard", "User Dashboard Component");

export default function UserDashboard() {
  useEffect(() => {
    componentLogger.debug("Component mounted");

    // Log user actions
    componentLogger.info("Dashboard loaded", {
      userId: "user123",
      loadTime: Date.now()
    });

    return () => {
      componentLogger.debug("Component unmounted");
    };
  }, []);

  const handleAction = (action: string) => {
    componentLogger.info("User action", { action, timestamp: new Date().toISOString() });
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={() => handleAction("button-click")}>
        Click me
      </button>
    </div>
  );
}
```

### In an API Route:

```typescript
import { createManagedLogger } from "@/lib/logger";

const apiLogger = createManagedLogger("api.orders", "Orders API");

export async function POST(request: Request) {
  apiLogger.info("Creating new order");

  try {
    const orderData = await request.json();
    apiLogger.debug("Order data received", { orderData });

    // Process order...
    const result = await processOrder(orderData);

    apiLogger.info("Order created successfully", { orderId: result.id });
    return Response.json(result);
  } catch (error) {
    apiLogger.error("Failed to create order", { error });
    return Response.json({ error: "Order creation failed" }, { status: 500 });
  }
}
```

## Admin Management

### API Endpoints for Administrators

#### Get all log handlers:

```bash
GET /api/admin/logs
```

#### Set log level for a handler:

```bash
PUT /api/admin/logs
Content-Type: application/json

{
  "handlerId": "payment-processing",
  "level": "debug",
  "cascadeToChildren": true
}
```

#### Create new handler:

```bash
POST /api/admin/logs
Content-Type: application/json

{
  "id": "new-feature",
  "name": "New Feature Logger",
  "level": "info",
  "parent": "ecommerce"
}
```

#### Remove handler:

```bash
DELETE /api/admin/logs?handlerId=old-feature
```

## Dynamic Log Level Control

Administrators with `GROUP_ALFRESCO_ADMINISTRATOR` or `GROUP_MINTRAL_SYSTEM_ADMIN` groups can:

1. **Discover all loggers** - See all registered log handlers across the application
2. **Change levels dynamically** - No need to restart the application
3. **Hierarchical control** - Change parent logger level and optionally cascade to children
4. **Real-time effect** - Changes take effect immediately

## Best Practices

### 1. Use descriptive IDs with dot notation for hierarchy:

```typescript
// Good
const userAuthLogger = createManagedLogger("auth.user", "User Authentication");
const adminAuthLogger = createManagedLogger(
  "auth.admin",
  "Admin Authentication"
);

// Better - with parent relationship
const authLogger = createManagedLogger("auth", "Authentication");
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

### 2. Create loggers at module level for reuse:

```typescript
// feature/payment/logger.ts
export const paymentLogger = createManagedLogger("payment", "Payment System");
export const stripeLogger = createManagedLogger(
  "payment.stripe",
  "Stripe",
  undefined,
  "payment"
);
export const paypalLogger = createManagedLogger(
  "payment.paypal",
  "PayPal",
  undefined,
  "payment"
);
```

### 3. Use appropriate log levels:

- `fatal` - Application crashes
- `error` - Errors that need attention
- `warn` - Warning conditions
- `info` - General information (default for production)
- `debug` - Detailed information for debugging
- `trace` - Very detailed tracing information

## Environment Variables

Set default levels via environment variables:

```bash
# Global default level
LOG_LEVEL=info

# Persistent handler configuration (JSON)
LOG_HANDLERS_CONFIG='{"payment": "debug", "auth": "warn"}'
```

## Security

- Only users in `GROUP_ALFRESCO_ADMINISTRATOR` or `GROUP_MINTRAL_SYSTEM_ADMIN` can manage log levels
- All sensitive data is automatically redacted (passwords, tokens, etc.)
- Log management actions are logged for audit trail
