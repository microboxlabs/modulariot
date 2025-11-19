# Dynamic Form Examples

## Example 1: Monitor Trip Task - ETA Mode (Already Implemented)

This example shows how to handle the scenario where users need to choose between calculated and manual ETA.

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
```

### Backend Logic
When backend receives:
- `prop_mintral_etaMode: "calculated"` → Calculate ETA assuming departure now
- `prop_mintral_etaMode: "manual"` + `prop_mintral_estimatedArrivalDate` → Calculate when truck should depart to arrive at specified time

## Example 2: Driver Assignment with Special Instructions

Add a form to capture special instructions when assigning a driver.

### Configuration
```typescript
const ASSIGN_DRIVER_CUSTOM_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_hasSpecialInstructions",
      labelKey: "hasSpecialInstructions",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_specialInstructions",
      labelKey: "specialInstructionsLabel",
      type: "textarea",
      required: true,
      placeholder: "Enter special instructions...",
      dependsOn: {
        fieldName: "prop_mintral_hasSpecialInstructions",
        value: true,
      },
    },
    {
      name: "prop_mintral_requiresEscort",
      labelKey: "requiresEscortLabel",
      type: "checkbox",
      defaultValue: false,
    },
  ],
};

// Add to TASK_FORMS_CONFIG
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  // ... other configs
  [TYPE_WFSHIP2_ASSIGN_DRIVER_TASK]: {
    [OUTCOME_TO_ASSIGN_DRIVER_V2]: {
      customFormConfig: ASSIGN_DRIVER_CUSTOM_FORM,
    },
  },
};
```

### i18n Keys
```json
{
  "modal": {
    "hasSpecialInstructions": "Has special instructions?",
    "specialInstructionsLabel": "Special Instructions",
    "requiresEscortLabel": "Requires security escort"
  }
}
```

## Example 3: Route Deviation Approval

Capture reason and new route details when approving a route deviation.

### Configuration
```typescript
const ROUTE_DEVIATION_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_deviationType",
      labelKey: "deviationTypeLabel",
      type: "select",
      required: true,
      defaultValue: "",
      options: [
        { value: "", labelKey: "selectDeviationType" },
        { value: "TRAFFIC", labelKey: "deviationTraffic" },
        { value: "ROAD_CLOSURE", labelKey: "deviationRoadClosure" },
        { value: "WEATHER", labelKey: "deviationWeather" },
        { value: "CLIENT_REQUEST", labelKey: "deviationClientRequest" },
        { value: "OTHER", labelKey: "deviationOther" },
      ],
    },
    {
      name: "prop_mintral_deviationReason",
      labelKey: "deviationReasonLabel",
      type: "textarea",
      required: true,
      dependsOn: {
        fieldName: "prop_mintral_deviationType",
        value: "OTHER",
      },
    },
    {
      name: "prop_mintral_estimatedDelay",
      labelKey: "estimatedDelayLabel",
      type: "text",
      placeholder: "e.g., 30 minutes",
    },
  ],
};
```

## Example 4: Delivery Confirmation with POD Details

Capture proof of delivery details including recipient information.

### Configuration
```typescript
const DELIVERY_CONFIRMATION_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_recipientName",
      labelKey: "recipientNameLabel",
      type: "text",
      required: true,
      placeholder: "Full name",
    },
    {
      name: "prop_mintral_recipientId",
      labelKey: "recipientIdLabel",
      type: "text",
      required: true,
      placeholder: "ID/RUT number",
    },
    {
      name: "prop_mintral_deliveryCondition",
      labelKey: "deliveryConditionLabel",
      type: "select",
      required: true,
      defaultValue: "GOOD",
      options: [
        { value: "GOOD", labelKey: "conditionGood" },
        { value: "DAMAGED", labelKey: "conditionDamaged" },
        { value: "PARTIAL", labelKey: "conditionPartial" },
      ],
    },
    {
      name: "prop_mintral_damageDescription",
      labelKey: "damageDescriptionLabel",
      type: "textarea",
      required: true,
      dependsOn: {
        fieldName: "prop_mintral_deliveryCondition",
        value: "DAMAGED",
      },
    },
    {
      name: "prop_mintral_deliveryNotes",
      labelKey: "deliveryNotesLabel",
      type: "textarea",
      placeholder: "Additional notes...",
    },
  ],
};
```

## Example 5: Vehicle Inspection Form

Pre-trip vehicle inspection checklist.

### Configuration
```typescript
const VEHICLE_INSPECTION_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_tiresOk",
      labelKey: "tiresOkLabel",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_lightsOk",
      labelKey: "lightsOkLabel",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_brakesOk",
      labelKey: "brakesOkLabel",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_fuelLevel",
      labelKey: "fuelLevelLabel",
      type: "select",
      required: true,
      options: [
        { value: "FULL", labelKey: "fuelFull" },
        { value: "THREE_QUARTERS", labelKey: "fuelThreeQuarters" },
        { value: "HALF", labelKey: "fuelHalf" },
        { value: "QUARTER", labelKey: "fuelQuarter" },
      ],
    },
    {
      name: "prop_mintral_hasIssues",
      labelKey: "hasIssuesLabel",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_issueDescription",
      labelKey: "issueDescriptionLabel",
      type: "textarea",
      required: true,
      dependsOn: {
        fieldName: "prop_mintral_hasIssues",
        value: true,
      },
    },
  ],
};
```

## Example 6: Temperature-Sensitive Cargo

Special handling for temperature-controlled transport.

### Configuration
```typescript
const TEMP_CONTROLLED_FORM: CustomFormConfig = {
  fields: [
    {
      name: "prop_mintral_requiresTempControl",
      labelKey: "requiresTempControlLabel",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "prop_mintral_targetTemp",
      labelKey: "targetTempLabel",
      type: "text",
      required: true,
      placeholder: "e.g., 4°C",
      dependsOn: {
        fieldName: "prop_mintral_requiresTempControl",
        value: true,
      },
    },
    {
      name: "prop_mintral_tempRange",
      labelKey: "tempRangeLabel",
      type: "select",
      required: true,
      dependsOn: {
        fieldName: "prop_mintral_requiresTempControl",
        value: true,
      },
      options: [
        { value: "FROZEN", labelKey: "tempFrozen" },
        { value: "REFRIGERATED", labelKey: "tempRefrigerated" },
        { value: "CONTROLLED", labelKey: "tempControlled" },
      ],
    },
    {
      name: "prop_mintral_initialTemp",
      labelKey: "initialTempLabel",
      type: "text",
      placeholder: "Initial temperature reading",
      dependsOn: {
        fieldName: "prop_mintral_requiresTempControl",
        value: true,
      },
    },
  ],
};
```

## Example 7: Combined Select + Custom Form

You can combine the existing select-based reason system with custom form fields.

### Configuration
```typescript
export const TASK_FORMS_CONFIG: TaskFormsConfig = {
  [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
    [OUTCOME_PREPARE_SERVICE_V2]: {
      // Keep the existing multi-select reasons
      selectConfig: SELECT_OPTIONS_CONFIG[TYPE_WFSHIP2_MISSION_CONTROL_TASK]?.[OUTCOME_PREPARE_SERVICE_V2],
      // Add custom form fields
      customFormConfig: {
        fields: [
          {
            name: "prop_mintral_alternativeContact",
            labelKey: "alternativeContactLabel",
            type: "text",
            placeholder: "Phone number",
          },
          {
            name: "prop_mintral_urgentDelivery",
            labelKey: "urgentDeliveryLabel",
            type: "checkbox",
            defaultValue: false,
          },
        ],
      },
    },
  },
};
```

This configuration will display:
1. The multi-select rejection reasons (existing functionality)
2. Additional custom form fields below it

## Tips for Creating Custom Forms

### 1. Use Meaningful Property Names
Always prefix with `prop_mintral_` to follow Alfresco conventions:
```typescript
name: "prop_mintral_myProperty" // Good
name: "myProperty"              // Bad - won't be processed by backend
```

### 2. Provide Good Defaults
```typescript
defaultValue: "calculated" // User sees this immediately
```

### 3. Use Conditional Visibility Wisely
Only show fields when relevant to reduce cognitive load:
```typescript
dependsOn: {
  fieldName: "prop_mintral_hasSpecialCase",
  value: true,
}
```

### 4. Leverage Required Fields
```typescript
required: true // Ensures user provides critical information
```

### 5. Add Helpful Placeholders
```typescript
placeholder: "e.g., +56 9 1234 5678" // Guides user input format
```

### 6. Group Related Fields
Organize fields logically in the array to create a natural flow.

### 7. Consider Mobile UX
- Avoid too many fields
- Use appropriate input types (e.g., `date` shows native date picker)
- Test on mobile devices

## Backend Processing

All custom properties are automatically sent to Alfresco's form service via the `updateTask` call. The backend code in `route.ts` handles this generically:

```typescript
// Automatically processes any prop_* field
Object.entries(json).forEach(([key, value]) => {
  if (key.startsWith("prop_") && /* not already handled */) {
    updateTaskPayload[key] = value;
  }
});
```

If you need custom business logic for specific properties, add it after the automatic processing:

```typescript
// After automatic processing
if (json.prop_mintral_etaMode === "manual") {
  // Calculate departure time based on manual ETA
  const departureTime = calculateDepartureTime(
    json.prop_mintral_estimatedArrivalDate
  );
  updateTaskPayload.prop_mintral_calculatedDepartureTime = departureTime;
}
```
