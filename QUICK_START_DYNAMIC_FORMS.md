# Quick Start: Adding Custom Forms to Tasks

## TL;DR

To add a custom form to a task action, follow these 3 steps:

### 1. Define the form in `task-confirm-modal.config.ts`

```typescript
// Add at the bottom of the file, before TASK_FORMS_CONFIG

const MY_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_myField",        // Backend property name
      labelKey: "myFieldLabel",            // i18n key
      type: "text",                        // Input type
      required: true,                      // Optional: validation
      defaultValue: "",                    // Optional: initial value
      placeholder: "Enter value...",       // Optional: placeholder
    },
  ],
};
```

### 2. Add to `TASK_FORMS_CONFIG` in same file

```typescript
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  // ... existing configs
  [TYPE_WFSHIP2_MY_TASK]: {
    [OUTCOME_MY_ACTION]: {  // ⚠️ Use OUTCOME_* not OUTCOME_TO_*
      customFormConfig: MY_CUSTOM_FORM,
    },
  },
};
```

### 3. Add i18n translations

In your dictionary file (e.g., `es.json`):
```json
{
  "modal": {
    "myFieldLabel": "Mi Campo"
  }
}
```

## Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text input | Name, phone number |
| `textarea` | Multi-line text | Notes, descriptions |
| `select` | Dropdown selection | Status, category |
| `date` | Date picker | Birth date |
| `datetime-local` | Date + time picker | Appointment time |
| `checkbox` | Boolean toggle | Agree to terms |

## Conditional Fields

Show a field only when another field has a specific value:

```typescript
{
  name: "prop_mintral_otherReason",
  labelKey: "otherReasonLabel",
  type: "textarea",
  dependsOn: {
    fieldName: "prop_mintral_reasonType",  // The field to watch
    value: "OTHER",                        // The value that shows this field
  },
}
```

## Select Field Options

For dropdown fields:

```typescript
{
  name: "prop_mintral_priority",
  labelKey: "priorityLabel",
  type: "select",
  required: true,
  defaultValue: "NORMAL",
  options: [
    { value: "LOW", labelKey: "priorityLow" },
    { value: "NORMAL", labelKey: "priorityNormal" },
    { value: "HIGH", labelKey: "priorityHigh" },
  ],
}
```

## Real Example: ETA Mode for Monitor Trip

```typescript
const MONITOR_TRIP_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    // Dropdown: Choose calculation mode
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
    // Date/time input: Only visible when "manual" is selected
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

// Register it
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  // ... other configs
  [TYPE_WFSHIP2_MONITOR_TRIP_TASK]: {
    [OUTCOME_MONITOR_TRIP_V2]: {  // "Monitorear viaje en curso"
      customFormConfig: MONITOR_TRIP_CUSTOM_FORM,
    },
  },
};
```

## Common Pitfall ⚠️

**Use the correct outcome constant:**

```typescript
// ✅ CORRECT - Current action outcome
[TYPE_WFSHIP2_MONITOR_TRIP_TASK]: {
  [OUTCOME_MONITOR_TRIP_V2]: { ... }  // "Monitorear viaje en curso"
}

// ❌ WRONG - Transition to next state
[TYPE_WFSHIP2_MONITOR_TRIP_TASK]: {
  [OUTCOME_TO_MONITOR_TRIP_V2]: { ... }  // "Confirmar Arribo" - wrong!
}
```

The modal receives the **current action label**, not the transition ID to the next state.

## Property Naming Convention

Always prefix custom properties with `prop_mintral_`:

```typescript
// ✅ CORRECT
name: "prop_mintral_myProperty"

// ❌ WRONG - Won't be processed by backend
name: "myProperty"
```

## Backend Processing

The backend automatically processes all `prop_*` fields and updates the Alfresco task properties. No backend code changes needed unless you need custom business logic.

## Testing Checklist

1. ✅ Form appears when clicking the task action button
2. ✅ All fields render correctly
3. ✅ Required fields show validation errors
4. ✅ Conditional fields show/hide based on dependencies
5. ✅ Form submits successfully
6. ✅ Task properties are updated in Alfresco
7. ✅ i18n labels display correctly in all languages

## Need Help?

- Full documentation: [DYNAMIC_FORM_IMPLEMENTATION.md](./DYNAMIC_FORM_IMPLEMENTATION.md)
- More examples: [DYNAMIC_FORM_EXAMPLES.md](./DYNAMIC_FORM_EXAMPLES.md)
- Check existing configs in [task-confirm-modal.config.ts](./src/features/task-forms/components/task-confirm-modal/task-confirm-modal.config.ts)
