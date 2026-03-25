# Message Templates Admin Console

A comprehensive admin console for managing message templates and webhook definitions for automated notifications.

## 🎯 Features Implemented

### ✅ 1. Backend API Integration

- **Alfresco API Provider** (`src/features/common/providers/alfresco-api/alfresco-api.provider.ts`)
  - Full CRUD operations for message templates
  - Full CRUD operations for webhook definitions
  - Type-safe interfaces and request/response models
  - Integration with existing Alfresco webscript endpoints

### ✅ 2. Admin-Only API Routes

- **Message Templates API** (`/app/api/admin/message-templates`)
  - GET: List templates with optional filtering by site/kind
  - POST: Create new templates
  - PUT: Update existing templates
  - DELETE: Remove templates
- **Webhooks API** (`/app/api/admin/webhooks`)
  - GET: List webhooks with grouping by webhookKind
  - POST: Create new webhook definitions
  - PUT: Update existing webhooks
  - DELETE: Remove webhooks

### ✅ 3. DRY Admin Access Control

- **Centralized Admin Utility** (`src/features/auth/utils/admin-access.ts`)
  - Reusable `hasAdminAccess()` and `hasAdminAccessForSession()` functions
  - Supports `GROUP_ALFRESCO_ADMINISTRATORS` and `GROUP_MINTRAL_SYSTEM_ADMIN`
  - Integrated with existing group validation system

### ✅ 4. SWR Data Fetching Hooks

- **Client API Provider** (`src/features/common/providers/client-api.provider.ts`)
  - `useMessageTemplates(site?, kind?)` - Fetch and manage templates
  - `useWebhookDefinitions(site?)` - Fetch and manage webhooks with grouping
  - CRUD operation functions for both templates and webhooks
  - Real-time data updates with SWR caching and revalidation

### ✅ 5. Admin Console UI

- **React Component** (`src/features/common/components/admin-message-templates-console/`)
  - Tabbed interface: Webhooks (primary) → Templates (secondary)
  - Webhooks grouped by `webhookKind` for better organization
  - Real-time CRUD operations with optimistic updates
  - Modal forms for creating/editing both webhooks and templates
  - Responsive design consistent with existing admin pages

### ✅ 6. Complete i18n Support

- **Spanish** (`src/lang/es.json`) and **English** (`src/lang/en.json`)
  - All UI strings properly localized
  - Error messages, form labels, validation text
  - Webhook kind translations (MS Teams, Slack, Email, etc.)
  - Template engine options (FreeMarker, Velocity, Mustache)

## 🚀 Business Logic Implementation

### Webhook-First Approach

The console prioritizes webhook management as the primary business function:

1. **Event-Driven Design**: `templateId` represents the business event to notify
2. **Grouped Organization**: Webhooks are grouped by `webhookKind` for easy management
3. **Template Association**: Easy linking between webhooks and message templates
4. **Template Creation**: Option to create new templates directly when setting up webhooks

### Template Management

Secondary but essential template management capabilities:

1. **Template Types**: Support for multiple webhook kinds and template engines
2. **Association Tracking**: Shows which webhooks use each template
3. **Content Editing**: Full template content management with syntax highlighting
4. **Lifecycle Management**: Safe deletion with usage validation

## 🔧 Usage Examples

### Creating a New Notification Event

```typescript
// 1. Create a message template
await createMessageTemplateClient({
  site: "mintral",
  kind: "MS_TEAMS",
  templateId: "TRIP_ALERT",
  engineExt: "ftl",
  content: `{
    "type": "message",
    "attachments": [{
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "body": [{
          "type": "TextBlock",
          "text": "🚚 Trip Alert: ${tripId}",
          "weight": "Bolder"
        }]
      }
    }]
  }`,
});

// 2. Create webhook definition
await createWebhookDefinitionClient({
  site: "mintral",
  templateId: "TRIP_ALERT",
  webhookKind: "MS_TEAMS",
  webhookUrl: "https://outlook.office.com/webhook/...",
  template: "workspace://SpacesStore/template-node-ref",
});
```

### Admin Operations

```typescript
// List all webhooks grouped by kind
const { groupedWebhooks } = useWebhookDefinitions("mintral");

// Get templates for a specific kind
const { templates } = useMessageTemplates("mintral", "MS_TEAMS");

// Update webhook URL
await updateWebhookDefinitionClient({
  webhookDef: "workspace://SpacesStore/webhook-node-ref",
  webhookUrl: "https://new-webhook-url.com",
});
```

## 🛡️ Security & Permissions

- **Admin-Only Access**: All routes protected by admin group membership
- **Session Validation**: Server-side session checking on all operations
- **Route Protection**: Console page requires admin access to view
- **Input Validation**: URL validation, required field checks, safe deletion

## 📱 UI/UX Features

### Consistent Design

- Matches existing admin console patterns
- Uses established breadcrumb navigation
- Consistent loading states and error handling
- Responsive grid layouts for cards

### User Experience

- **Grouped Display**: Webhooks organized by type (Teams, Slack, Email, etc.)
- **Quick Actions**: Edit, delete, associate/dissociate templates
- **Modal Forms**: Non-intrusive creation/editing workflows
- **Real-time Updates**: Immediate UI updates after operations
- **Error Handling**: Friendly error messages with recovery suggestions

### Accessibility

- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly labels
- High contrast color schemes

## 🎛️ Admin Control Panel

Access the console at: `/[lang]/admin/console/message-templates`

### Webhooks Tab (Primary)

- View all webhooks grouped by type
- Create new webhook definitions
- Associate with existing or new templates
- Edit webhook URLs and event names
- Delete unused webhooks

### Templates Tab (Secondary)

- View all message templates
- Create new templates with content editor
- See which webhooks use each template
- Edit template content and metadata
- Safe deletion with usage validation

## 🔄 Data Flow

1. **Admin creates webhook** → Associates with template → System can send notifications
2. **Template modification** → All associated webhooks use updated template
3. **Webhook deletion** → Template remains available for other webhooks
4. **Template deletion** → Blocked if in use by active webhooks

## 🎯 Next Steps (Optional Enhancements)

- **Template Preview**: Real-time template rendering with sample data
- **Webhook Testing**: Send test messages to validate configuration
- **Usage Analytics**: Track webhook delivery success rates
- **Template Versioning**: History of template changes
- **Bulk Operations**: Import/export webhook configurations
- **Template Library**: Pre-built templates for common notification types

---

**The system is production-ready and provides a complete solution for managing message templates and webhook definitions with enterprise-grade security and user experience.**
