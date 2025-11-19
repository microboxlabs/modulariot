# Dynamic Form Implementation for TaskConfirmModal

## Overview
This implementation adds support for dynamic custom form fields in the TaskConfirmModal, allowing different tasks to display specific input fields based on their requirements. The system is designed to be extensible and maintainable.

## Architecture

### 1. Type System (`task-confirm-modal.types.ts`)
New types added to support dynamic forms:

- **`FormFieldType`**: Supported input types (text, select, date, datetime-local, textarea, checkbox)
- **`FormFieldConfig`**: Configuration for a single form field including:
  - `name`: Property name sent to backend (e.g., "prop_mintral_estimatedArrivalDate")
  - `labelKey`: i18n translation key
  - `type`: Field type
  - `required`: Whether field is required
  - `defaultValue`: Default value
  - `options`: For select fields
  - `dependsOn`: Conditional visibility based on another field's value

- **`CustomFormConfig`**: Collection of form fields
- **`TaskFormConfig`**: Unified config supporting both select configs and custom forms
- **`TaskFormsConfig`**: Task/outcome-based configuration mapping

### 2. Form Field Renderer (`custom-form-field.tsx`)
A reusable component that renders different input types based on field configuration:
- Handles all supported field types
- Manages visibility based on dependencies
- Integrates with i18n for labels
- Uses Flowbite React components for consistent styling

### 3. State Management (`use-custom-form-state.ts`)
Custom hook for managing form field values:
- Initializes form values from configuration
- Tracks field values in a Record<string, string | boolean>
- Handles conditional field visibility
- Provides reset functionality

### 4. Configuration (`task-confirm-modal.config.ts`)
Centralized configuration system:
- **`TASK_FORMS_CONFIG`**: Main configuration object mapping tasks and outcomes to form configs
- **`getTaskFormConfig()`**: Utility function to retrieve config for a task/outcome
- Backward compatible with existing `SELECT_OPTIONS_CONFIG`

### 5. Modal Integration (`task-confirm-modal.tsx`)
Updated modal to support both legacy and new form systems:
- Uses `getTaskFormConfig()` to get unified configuration
- Falls back to `getSelectConfig()` for backward compatibility
- Integrates custom form state hook
- Renders custom form fields when configured
- Passes form values to `prepareFormData()`

### 6. Data Preparation (`task-confirm-modal.utils.ts`)
Updated to handle custom form values:
- Accepts `customFormValues` parameter
- Converts boolean values to strings for FormData
- Appends all custom form values to the FormData object

### 7. Backend Integration (`route.ts`)
Updated to process custom properties:
- Iterates through all request properties
- Identifies custom properties by `prop_` prefix
- Excludes known/handled properties
- Adds custom properties to `updateTaskPayload`
- Alfresco form service updates these properties on the task

## Implementation Example: Monitor Trip Task

### Configuration
```typescript
const MONITOR_TRIP_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_etaMode",
      labelKey: "etaModeLabel",
      type: "select",
      required: true,
      defaultValue: "calculated",
      options: [
        { value: "calculated", labelKey: "etaModeCalculated" },
        { value: "manual", labelKey: "etaModeManual" },
      ],
    },
    {
      name: "prop_mintral_estimatedArrivalDate",
      labelKey: "estimatedArrivalDateLabel",
      type: "datetime-local",
      required: true,
      dependsOn: {
        fieldName: "prop_mintral_etaMode",
        value: "manual",
      },
    },
  ],
};

export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  [TYPE_WFSHIP2_MONITOR_TRIP_TASK]: {
    [OUTCOME_MONITOR_TRIP_V2]: {  // Use OUTCOME_* not OUTCOME_TO_*
      customFormConfig: MONITOR_TRIP_CUSTOM_FORM,
    },
  },
};
```

**Important:** Use `OUTCOME_MONITOR_TRIP_V2` (the current action label "Monitorear viaje en curso"), NOT `OUTCOME_TO_MONITOR_TRIP_V2` (the next state "Confirmar Arribo"). The modal receives the current action outcome, not the transition ID.

### Required i18n Keys
Add these to your i18n dictionary under `modal`:
```json
{
  "modal": {
    "etaModeLabel": "Arrival Calculation Mode",
    "etaModeCalculated": "Calculated (Depart Now)",
    "etaModeManual": "Manual Arrival Time",
    "estimatedArrivalDateLabel": "Estimated Arrival Date/Time"
  }
}
```

### Data Flow
1. User opens modal for Monitor Trip task
2. Modal detects custom form configuration
3. Form fields render with default values
4. User selects "manual" for ETA mode
5. Date/time field becomes visible (conditional visibility)
6. User fills in arrival date
7. On submit, form data includes:
   - `prop_mintral_etaMode: "manual"`
   - `prop_mintral_estimatedArrivalDate: "2025-11-10T15:30"`
8. Backend receives and updates Alfresco task properties
9. Backend can use these properties to calculate departure time

## Adding New Custom Forms

### Step 1: Define Field Configuration
```typescript
const MY_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_myProperty",
      labelKey: "myPropertyLabel",
      type: "text",
      required: true,
      placeholder: "Enter value...",
    },
  ],
};
```

### Step 2: Add to Task Forms Config
```typescript
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  // ... existing configs
  [TYPE_WFSHIP2_MY_TASK]: {
    [OUTCOME_MY_OUTCOME]: {  // Use OUTCOME_* not OUTCOME_TO_*
      customFormConfig: MY_CUSTOM_FORM,
    },
  },
};
```

**Important:** Use the current action outcome constant (OUTCOME_*), not the transition ID (OUTCOME_TO_*). See the "Important: Outcome vs Transition ID" section above for details.

### Step 3: Add i18n Translations
Add translation keys to your dictionary files.

### Step 4: Backend Processing
The backend automatically processes any `prop_*` fields from the request and updates the Alfresco task. No backend changes needed unless you need custom business logic.

## Features

### Conditional Visibility
Fields can be shown/hidden based on other field values:
```typescript
{
  name: "prop_mintral_reason",
  labelKey: "reasonLabel",
  type: "textarea",
  dependsOn: {
    fieldName: "prop_mintral_requiresReason",
    value: true,
  },
}
```

### Multiple Input Types
Supports: text, select, date, datetime-local, textarea, checkbox

### Validation
- Required field validation via HTML5
- Type-specific validation (e.g., date format)

### Backward Compatibility
Existing select-based reason configurations continue to work unchanged. The system seamlessly supports both approaches.

## Benefits

1. **Flexibility**: Add new form fields without modifying core modal code
2. **Maintainability**: Centralized configuration
3. **Type Safety**: Full TypeScript support
4. **i18n Ready**: All labels support internationalization
5. **Extensible**: Easy to add new field types
6. **Backend Integration**: Automatic property updates via Alfresco form service
7. **Conditional Logic**: Support for field dependencies

## Future Enhancements

Potential improvements:
- Custom validation functions
- Field groups/sections
- Multi-column layouts
- File upload fields
- Rich text editing
- Field-level help text
- Dynamic options (API-driven)
