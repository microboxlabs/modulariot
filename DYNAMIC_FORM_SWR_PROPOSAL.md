# Dynamic Form with SWR Integration Proposal

## Overview
Revised proposal for supporting live/calculated values in dynamic forms using SWR for data fetching, maintaining proper separation of concerns and React best practices.

## Revised Architecture

### 1. Field Configuration (Simplified)

```typescript
export type FormFieldType =
  | "text"
  | "select"
  | "date"
  | "datetime-local"
  | "textarea"
  | "checkbox"
  | "display"        // Read-only display field
  | "live";          // Live value with SWR fetching

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

  // Simplified for display fields
  readonly?: boolean;
  displayFormat?: "text" | "badge" | "datetime" | "custom";

  // For live fields - just metadata, not logic
  liveField?: {
    dataKey: string;                    // Key to identify what data to fetch
    displayFormat?: "text" | "badge" | "datetime";
    formatter?: string;                  // Name of formatter function to use
    dependencies?: string[];             // Fields that affect this value
  };

  // Custom component support
  customComponent?: string;              // Name of custom component to use
};
```

### 2. Custom Hook with SWR for Live Values

```typescript
// hooks/use-live-form-value.ts
import useSWR from 'swr';

interface ETAResponse {
  estimatedArrival: string;
  duration: number;
  distance: number;
}

// Fetcher for ETA calculations
const etaFetcher = async (url: string, params: any) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch ETA');
  }

  return response.json();
};

export function useLiveETA(
  enabled: boolean,
  origin?: string,
  destination?: string,
  mode: string = 'calculated'
) {
  // Only fetch when in calculated mode and we have required data
  const shouldFetch = enabled && mode === 'calculated' && origin && destination;

  const { data, error, isLoading, mutate } = useSWR<ETAResponse>(
    shouldFetch ? [`/api/task/calculate-eta`, { origin, destination }] : null,
    ([url, params]) => etaFetcher(url, params),
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
    }
  );

  return {
    eta: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
```

### 3. Live Value Field Component

```typescript
// components/live-form-field.tsx
"use client";

import { Badge, Spinner } from "flowbite-react";
import { useLiveETA } from "../hooks/use-live-form-value";

interface LiveFormFieldProps {
  field: FormFieldConfig;
  allValues: Record<string, any>;
  isVisible: boolean;
  dict: I18nRecord;
}

export function LiveFormField({
  field,
  allValues,
  isVisible,
  dict,
}: LiveFormFieldProps) {
  // For ETA field specifically
  const isETAField = field.liveField?.dataKey === 'eta';

  const { eta, isLoading, error } = useLiveETA(
    isETAField && isVisible,
    allValues.prop_mintral_origin,
    allValues.prop_mintral_destination,
    allValues.prop_mintral_etaMode
  );

  if (!isVisible) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-gray-500">Calculating ETA...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Unable to calculate ETA
      </div>
    );
  }

  if (!eta) return null;

  // Format the display based on configuration
  const formattedValue = formatETA(eta);

  switch (field.liveField?.displayFormat) {
    case 'badge':
      return (
        <Badge color="info" size="sm">
          {formattedValue}
        </Badge>
      );
    case 'datetime':
      return (
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-900">
            {formattedValue}
          </span>
        </div>
      );
    default:
      return <span className="text-gray-900">{formattedValue}</span>;
  }
}

function formatETA(eta: ETAResponse): string {
  const date = new Date(eta.estimatedArrival);
  const hours = Math.floor(eta.duration / 60);
  const minutes = eta.duration % 60;

  return `${date.toLocaleString()} (${hours}h ${minutes}m)`;
}
```

### 4. Enhanced CustomFormField with Live Support

```typescript
// custom-form-field.tsx
import { LiveFormField } from "./live-form-field";

export function CustomFormField({
  field,
  value,
  onChange,
  dict,
  isVisible,
  allValues,  // Pass all form values for dependencies
}: CustomFormFieldProps) {
  if (!isVisible) return null;

  // Delegate to LiveFormField for live fields
  if (field.type === 'live') {
    return (
      <div className="flex flex-col gap-2">
        <Label>
          {tr(field.labelKey, dict)}
        </Label>
        <LiveFormField
          field={field}
          allValues={allValues}
          isVisible={isVisible}
          dict={dict}
        />
      </div>
    );
  }

  // Handle display fields
  if (field.type === 'display') {
    return (
      <div className="flex flex-col gap-2">
        <Label>
          {tr(field.labelKey, dict)}
        </Label>
        <DisplayField
          field={field}
          value={value}
          dict={dict}
        />
      </div>
    );
  }

  // ... existing field types
}
```

### 5. Display Field Component (Non-Live)

```typescript
// components/display-field.tsx
import { Badge } from "flowbite-react";

interface DisplayFieldProps {
  field: FormFieldConfig;
  value: string | boolean;
  dict: I18nRecord;
}

export function DisplayField({ field, value, dict }: DisplayFieldProps) {
  const displayValue = value as string;

  switch (field.displayFormat) {
    case 'badge':
      return (
        <Badge color="gray" size="sm">
          {displayValue}
        </Badge>
      );
    case 'datetime':
      return (
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-900">
            {new Date(displayValue).toLocaleString()}
          </span>
        </div>
      );
    default:
      return (
        <span className="text-gray-900 font-medium">
          {displayValue}
        </span>
      );
  }
}
```

### 6. Monitor Trip Configuration

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
      type: "live",  // Live field type
      dependsOn: {
        fieldName: "prop_mintral_etaMode",
        value: "calculated",
      },
      liveField: {
        dataKey: "eta",
        displayFormat: "datetime",
        dependencies: ["prop_mintral_origin", "prop_mintral_destination"],
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

## SWR Benefits in This Approach

1. **Proper Separation**: SWR logic stays in hooks and components, not in configuration
2. **Built-in Caching**: SWR handles caching automatically
3. **Deduplication**: Multiple components can use the same data without duplicate requests
4. **Background Refetch**: Automatic revalidation on focus/network recovery
5. **Optimistic Updates**: Can implement optimistic UI updates
6. **Error Retry**: Built-in exponential backoff retry logic
7. **Request Deduplication**: Prevents duplicate requests for the same data

## Custom SWR Hooks for Different Live Values

```typescript
// hooks/use-live-values.ts

// Generic live value hook
export function useLiveValue<T>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: any[],
  options?: SWRConfiguration
) {
  const shouldFetch = dependencies.every(dep => dep !== undefined);

  return useSWR<T>(
    shouldFetch ? [key, ...dependencies] : null,
    fetcher,
    options
  );
}

// Specific hooks for different data types
export function useLiveValidation(serviceCode: string) {
  return useSWR(
    serviceCode ? `/api/validation/${serviceCode}` : null,
    (url) => fetch(url).then(res => res.json()),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );
}

export function useLiveGPSLocation(vehicleId: string) {
  return useSWR(
    vehicleId ? `/api/gps/${vehicleId}` : null,
    (url) => fetch(url).then(res => res.json()),
    {
      refreshInterval: 5000, // Refresh every 5 seconds for real-time tracking
    }
  );
}
```

## Implementation Pattern

### Step 1: Create Custom Hook for Data
```typescript
export function useYourLiveData(params) {
  return useSWR(key, fetcher, options);
}
```

### Step 2: Create Display Component
```typescript
export function YourLiveField({ field, allValues }) {
  const { data, isLoading, error } = useYourLiveData(params);
  // Render based on state
}
```

### Step 3: Register in CustomFormField
```typescript
if (field.liveField?.dataKey === 'your-data-key') {
  return <YourLiveField ... />;
}
```

### Step 4: Configure in Form
```typescript
{
  type: "live",
  liveField: { dataKey: "your-data-key" }
}
```

## Advantages of This Approach

1. **Clean Separation**: Configuration stays declarative, logic stays in components
2. **Testable**: Hooks and components can be tested independently
3. **Reusable**: SWR hooks can be used outside of forms
4. **Performance**: SWR's caching and deduplication improve performance
5. **Type Safety**: Each live value hook can have proper TypeScript types
6. **Flexibility**: Easy to add new live value types without changing core structure

## Future Enhancements

1. **Global SWR Configuration**: Set up SWR config provider for consistent behavior
2. **Prefetching**: Prefetch common values on form load
3. **Suspense Support**: Use React Suspense for loading states
4. **Mutation Support**: Use SWR mutations for optimistic updates
5. **WebSocket Integration**: Combine SWR with WebSocket for real-time updates