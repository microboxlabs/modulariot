# Form Submission Refactoring

## Problem

The previous implementation of `taskNextAction` was hardcoding specific field names, which created several issues:

1. **Lack of Scalability**: Every new form field required modifying the `taskNextAction` function
2. **Maintenance Burden**: Multiple places needed updates when adding dynamic fields
3. **Poor Design**: The function was tightly coupled to specific field names instead of being generic
4. **Missing Fields**: Dynamic form fields (like ETA mode, manual ETA reason, etc.) were not being sent to the backend

### Old Implementation

```typescript
export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  // Hardcoded field extraction
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const comments = formData.get("comments");
  const nativeGenerationEnabled = formData.get("nativeGenerationEnabled");
  const reasonId = formData.get("reasonId");
  const reason = formData.get("reason");
  const reasons = formData.get("reasons");
  const isMultiReason = formData.get("isMultiReason");

  return fetcherClient<TaskNextActionState>("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Manually building the payload
      taskId,
      transitionId,
      comments,
      nativeGenerationEnabled,
      reasonId,
      reason,
      reasons,
      isMultiReason,
      // Missing: all dynamic fields!
    }),
  });
}
```

## Solution

Refactored to use a **generic, dynamic approach** that automatically converts all FormData entries to JSON:

### New Implementation

```typescript
/**
 * Converts FormData to a plain object, handling special cases for JSON strings
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Try to parse JSON strings (like "reasons" field)
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        obj[key] = JSON.parse(value);
      } catch {
        // If parsing fails, keep as string
        obj[key] = value;
      }
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  // Convert all FormData entries to a plain object dynamically
  const payload = formDataToObject(formData);

  return fetcherClient<TaskNextActionState>("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
```

## Benefits

### 1. **Future-Proof**
- Adding new fields to forms (static or dynamic) requires NO changes to `taskNextAction`
- All fields in FormData are automatically included in the payload

### 2. **Maintainable**
- Single source of truth: `prepareFormData` function handles all field preparation
- No duplication of field names across multiple functions

### 3. **Type-Safe**
- FormData preparation is centralized in `task-confirm-modal.utils.ts`
- Clear separation of concerns

### 4. **Flexible**
- Handles JSON-stringified values (like the `reasons` array)
- Works with any field type: strings, booleans, arrays, objects

### 5. **Clean Architecture**
```
┌─────────────────────────────────────┐
│  Modal Component                    │
│  (task-confirm-modal.tsx)           │
│  - Collects form values             │
│  - Manages state                    │
└──────────────┬──────────────────────┘
               │
               ├─> prepareFormData()
               │   (task-confirm-modal.utils.ts)
               │   - Builds FormData with ALL fields
               │
               └─> taskNextAction()
                   (client-form.service.ts)
                   - Dynamically converts FormData to JSON
                   - Sends to API
```

## Additional Fixes

### Form Submission Handler
Changed the button from `onClick` to `type="submit"` to properly trigger form validation:

```typescript
// Before
<Button onClick={handleConfirm}>Confirm</Button>

// After
<Button type="submit">Confirm</Button>

// Handler also updated to prevent default
async function handleConfirm(e?: React.FormEvent<HTMLFormElement>) {
  e?.preventDefault();
  // ... rest of logic
}
```

## Testing

To verify all fields are being sent:

1. Open browser DevTools → Network tab
2. Submit a form with dynamic fields
3. Check the request payload to `/app/api/task/end`
4. Verify all fields are present:
   - Static fields: `taskId`, `transitionId`, `comments`, etc.
   - Dynamic fields: `mintral_etaMode`, `mintral_estimatedArrivalDate`, `mintral_manualEtaReason`, etc.

## Example Payload

For a Monitor Trip task with manual ETA:

```json
{
  "taskId": "task123",
  "transitionId": "MONITOR_TRIP_V2",
  "comments": "",
  "reasonId": "wfship2:missionControlTask",
  "mintral_etaMode": "manual",
  "mintral_estimatedArrivalDate": "2025-11-20T14:30:00.000Z",
  "mintral_manualEtaReason": "DESTINATION_SCHEDULE_RESTRICTIONS",
  "mintral_originDelegateCode": "ORIGIN123",
  "mintral_destinationDelegateCode": "DEST456"
}
```

All fields are automatically included without hardcoding!

## Date/Time Handling

### Problem with datetime-local inputs

HTML `datetime-local` inputs use the format `YYYY-MM-DDTHH:mm` without timezone information. Sending this to the server is problematic because:
- The server doesn't know what timezone the datetime is in
- Different users in different timezones would send ambiguous values
- Server-side processing becomes error-prone

### Solution: Proper Timezone Conversion

We use a two-step approach:

1. **UI Layer (datetime-local input)**: Uses `YYYY-MM-DDTHH:mm` format for browser compatibility
   ```typescript
   // Convert ISO to datetime-local for the input field
   const datetimeLocal = dayjs(eta.estimatedArrival).format("YYYY-MM-DDTHH:mm");
   ```

2. **Submission Layer**: Converts to ISO 8601 with timezone before sending to server
   ```typescript
   // In prepareFormData()
   if (key === "mintral_estimatedArrivalDate" && typeof value === "string") {
     const isoDate = dayjs(value).toISOString();
     formData.append(key, isoDate);
   }
   ```

### Example Flow

```
User enters in UI: "2025-11-20T14:30"
                   ↓
Stored in state:  "2025-11-20T14:30"
                   ↓
Sent to server:   "2025-11-20T14:30:00.000Z" (ISO 8601 with UTC)
```

This ensures:
- ✅ Browser compatibility with native datetime inputs
- ✅ Server receives unambiguous timezone-aware datetimes
- ✅ Proper handling across different user timezones
- ✅ No manual date string manipulation

## Backend API Integration

### Problem: Alfresco Property Naming

Alfresco requires task properties to be prefixed with `prop_`. The old implementation hardcoded specific field names, making it impossible to support dynamic forms.

### Solution: Automatic Property Mapping

The `/app/api/task/end` route now automatically maps form fields to Alfresco properties:

```typescript
// In route.ts
Object.entries(json).forEach(([key, value]) => {
  if (skipFields.has(key)) {
    return;
  }

  // If already has prop_ prefix, use as-is
  if (key.startsWith("prop_")) {
    updateTaskPayload[key] = value;
  }
  // If starts with mintral_, add prop_ prefix
  else if (key.startsWith("mintral_")) {
    const propKey = `prop_${key}`;
    updateTaskPayload[propKey] = value;
  }
  // For any other custom fields, add prop_ prefix
  else if (!key.startsWith("_")) {
    const propKey = `prop_${key}`;
    updateTaskPayload[propKey] = value;
  }
});
```

### Mapping Rules

| Frontend Field Name | Backend Property Name |
|---------------------|----------------------|
| `mintral_etaMode` | `prop_mintral_etaMode` |
| `mintral_estimatedArrivalDate` | `prop_mintral_estimatedArrivalDate` |
| `mintral_manualEtaReason` | `prop_mintral_manualEtaReason` |
| `prop_custom_field` | `prop_custom_field` (unchanged) |
| `customField` | `prop_customField` |

### Skip List

The following fields are **not** mapped as they have special handling:
- `taskId`, `transitionId` - Core task identifiers
- `comments`, `nativeGenerationEnabled` - Legacy fields with custom logic
- `reason`, `reasonId`, `reasons`, `isMultiReason` - Reason handling
- Fields starting with `_` - Internal Next.js fields

### Benefits

✅ **Automatic mapping**: New form fields work without backend changes
✅ **Consistent naming**: All Alfresco properties follow `prop_*` convention
✅ **Backward compatible**: Existing fields continue to work
✅ **Type-safe**: TypeScript index signatures ensure type safety

### Example Update Payload

For the ETA form, the following update is sent to Alfresco:

```json
{
  "prop_cm_owner": "user@example.com",
  "prop_mintral_etaMode": "manual",
  "prop_mintral_estimatedArrivalDate": "2025-11-20T14:30:00.000Z",
  "prop_mintral_manualEtaReason": "DESTINATION_SCHEDULE_RESTRICTIONS",
  "prop_bpm_comment": ""
}
```

All dynamic fields are automatically included!
