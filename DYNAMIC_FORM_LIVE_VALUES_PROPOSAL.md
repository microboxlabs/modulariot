# Dynamic Form Live Values Support Proposal

## Overview
This document proposes extensions to the current dynamic form implementation to support live/calculated values, specifically for displaying the calculated ETA when in "calculated" mode, while maintaining flexibility for other use cases.

## Current Limitations
The current implementation only supports input fields (text, select, date, textarea, checkbox). There's no mechanism for:
1. Display-only values that aren't editable
2. Live/calculated values that update based on other field values
3. Custom display components (badges, spans, formatted text)
4. Async data fetching for calculated values

## Proposed Solution

### 1. Extended Field Types

#### Add new field types to `FormFieldType`:
```typescript
export type FormFieldType =
  | "text"
  | "select"
  | "date"
  | "datetime-local"
  | "textarea"
  | "checkbox"
  | "display"        // New: Read-only display field
  | "badge"          // New: Badge component
  | "calculated";    // New: Calculated/live value field
```

### 2. Enhanced FormFieldConfig

```typescript
export type FormFieldConfig = {
  name: string;
  labelKey: string;
  type: FormFieldType;
  required?: boolean;
  defaultValue?: string | boolean;
  options?: FormFieldOption[];
  dependsOn?: {
    fieldName: string;
    value: string | boolean;
  };
  placeholder?: string;

  // New properties for live values
  readonly?: boolean;                    // Makes any field read-only
  displayFormat?: "text" | "badge" | "datetime" | "custom";  // Display format for display fields
  calculateFrom?: {                      // For calculated fields
    dependencies: string[];              // Fields that trigger recalculation
    calculator: (values: Record<string, any>) => Promise<string> | string;
  };
  liveValue?: {                         // For async live values
    endpoint?: string;                   // API endpoint to fetch value
    params?: (values: Record<string, any>) => Record<string, any>;  // Dynamic params
    refreshOn?: string[];                // Fields that trigger refresh
    refreshInterval?: number;            // Auto-refresh interval in ms
    formatter?: (value: any) => string;  // Format the fetched value
  };
  customRenderer?: React.ComponentType<CustomFieldRendererProps>;  // Custom component
};
```

### 3. Implementation for Monitor Trip ETA

#### Configuration Example:
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
      name: "prop_mintral_calculatedEta",
      labelKey: "calculatedEtaLabel",
      type: "display",
      displayFormat: "datetime",
      dependsOn: {
        fieldName: "prop_mintral_etaMode",
        value: "calculated",
      },
      liveValue: {
        endpoint: "/api/alfresco/eta/calculate",
        params: (values) => ({
          origin: values.prop_mintral_origin,
          destination: values.prop_mintral_destination,
          departureMode: "now",
        }),
        refreshOn: ["prop_mintral_origin", "prop_mintral_destination"],
        formatter: (value) => {
          if (!value) return "Calculating...";
          const date = new Date(value.estimatedArrival);
          return date.toLocaleString();
        },
      },
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

### 4. Enhanced CustomFormField Component

```typescript
// custom-form-field.tsx additions

import { Badge, Spinner } from "flowbite-react";
import { useEffect, useState } from "react";

export function CustomFormField({
  field,
  value,
  onChange,
  dict,
  isVisible,
  allValues,  // New: all form values for calculations
}: CustomFormFieldProps) {
  const [liveValue, setLiveValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Handle live value fetching
  useEffect(() => {
    if (field.liveValue && isVisible) {
      fetchLiveValue();
    }
  }, [
    isVisible,
    ...(field.liveValue?.refreshOn?.map(f => allValues[f]) || [])
  ]);

  const fetchLiveValue = async () => {
    if (!field.liveValue) return;

    setIsLoading(true);
    try {
      const params = field.liveValue.params?.(allValues) || {};
      const response = await fetch(field.liveValue.endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      const formatted = field.liveValue.formatter?.(data) || data;
      setLiveValue(formatted);
      onChange(formatted); // Update form state
    } catch (error) {
      setLiveValue("Error loading value");
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = () => {
    switch (field.type) {
      case "display":
        return renderDisplayField();
      case "badge":
        return renderBadgeField();
      case "calculated":
        return renderCalculatedField();
      // ... existing cases
    }
  };

  const renderDisplayField = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-gray-500">Loading...</span>
        </div>
      );
    }

    const displayValue = field.liveValue ? liveValue : (value as string);

    switch (field.displayFormat) {
      case "badge":
        return (
          <Badge color="info" className="inline-flex">
            {displayValue}
          </Badge>
        );
      case "datetime":
        return (
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-900">
              {displayValue}
            </span>
          </div>
        );
      default:
        return (
          <span className="text-gray-900">{displayValue}</span>
        );
    }
  };

  // Rest of implementation...
}
```

### 5. Enhanced Hook for Form State

```typescript
// use-custom-form-state.ts additions

export function useCustomFormState(
  openModal: boolean,
  customFormConfig: CustomFormConfig | undefined
): CustomFormState {
  const [formValues, setFormValues] = useState<CustomFormValues>({});
  const [calculatedValues, setCalculatedValues] = useState<Record<string, any>>({});

  // Handle calculated fields
  useEffect(() => {
    if (!customFormConfig) return;

    customFormConfig.fields.forEach(async (field) => {
      if (field.calculateFrom) {
        const deps = field.calculateFrom.dependencies.map(d => formValues[d]);
        const result = await field.calculateFrom.calculator(formValues);
        setCalculatedValues(prev => ({ ...prev, [field.name]: result }));
      }
    });
  }, [formValues, customFormConfig]);

  // Rest of implementation...
}
```

## Usage Examples

### 1. Basic Display Field
```typescript
{
  name: "prop_mintral_infoText",
  labelKey: "infoLabel",
  type: "display",
  defaultValue: "This is read-only information",
  displayFormat: "text"
}
```

### 2. Badge Status Display
```typescript
{
  name: "prop_mintral_status",
  labelKey: "statusLabel",
  type: "display",
  displayFormat: "badge",
  calculateFrom: {
    dependencies: ["prop_mintral_etaMode"],
    calculator: (values) =>
      values.prop_mintral_etaMode === "manual" ? "Manual" : "Auto"
  }
}
```

### 3. Live ETA with API Call
```typescript
{
  name: "prop_mintral_calculatedEta",
  labelKey: "etaLabel",
  type: "display",
  displayFormat: "datetime",
  liveValue: {
    endpoint: "/api/eta/calculate",
    params: (values) => ({
      origin: values.origin,
      destination: values.destination,
      mode: "driving"
    }),
    refreshOn: ["origin", "destination"],
    formatter: (data) => {
      const eta = new Date(data.estimatedArrival);
      return `Arrival: ${eta.toLocaleString()} (${data.duration} mins)`;
    }
  }
}
```

## Benefits

1. **Flexibility**: Support for various display types without being limited to inputs
2. **Live Updates**: Real-time calculation and API integration
3. **Better UX**: Clear distinction between editable and read-only values
4. **Extensibility**: Custom renderers for complex display requirements
5. **Backward Compatible**: Existing forms continue to work without changes

## Implementation Steps

1. **Phase 1**: Extend types and add basic display field support
2. **Phase 2**: Implement live value fetching with API integration
3. **Phase 3**: Add calculated field support with dependency tracking
4. **Phase 4**: Implement custom renderers and advanced formatting

## API Integration for ETA

### Proposed Alfresco Proxy Endpoint
```typescript
// /api/task/calculate-eta
export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.json();

  // Call Alfresco proxy which will call PgRest
  const etaData = await calculateETA(session, {
    originGeofence: body.origin,
    destinationGeofence: body.destination,
    doubleDriver: body.doubleDriver || false,
    percentile: "p75",
    startDate: new Date().toISOString(),
  });

  return NextResponse.json({
    estimatedArrival: etaData.estimatedArrival,
    duration: etaData.durationMinutes,
    distance: etaData.distanceKm,
  });
}
```

## Testing Strategy

1. **Unit Tests**: Test each new field type independently
2. **Integration Tests**: Test live value fetching and updates
3. **E2E Tests**: Complete form flow with calculated ETA
4. **Performance Tests**: Ensure live updates don't impact form performance

## Future Enhancements

1. **Caching**: Cache calculated values to reduce API calls
2. **Debouncing**: Debounce live value updates for better performance
3. **Error States**: Enhanced error handling and display
4. **Loading States**: Skeleton loaders for better UX
5. **Validation**: Validate calculated values before submission