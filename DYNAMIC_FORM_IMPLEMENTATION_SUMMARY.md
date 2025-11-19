# Dynamic Form with Live Values - Implementation Summary

## Overview
Successfully implemented support for live/calculated values in the dynamic form system using SWR for data fetching, specifically designed for ETA calculation in Monitor Trip tasks.

## Files Created

### 1. **hooks/use-live-eta.ts**
- Custom SWR hook for fetching ETA calculations
- Handles API calls to `/api/task/calculate-eta` endpoint
- Includes auto-refresh (every 60 seconds) and error retry logic
- Provides formatted output functions for different display needs

### 2. **display-field.tsx**
- Component for rendering static read-only values
- Supports multiple display formats: text, badge, datetime
- Dark mode compatible

### 3. **live-form-field.tsx**
- Component for rendering live values fetched via SWR
- Specifically integrated with `useLiveETA` hook
- Shows loading states, error states, and formatted ETA data
- Includes visual enhancements (clock icon, distance info)

## Files Modified

### 1. **task-confirm-modal.types.ts**
- Added new field types: `"display"` and `"live"`
- Extended `FormFieldConfig` with:
  - `readonly?: boolean`
  - `displayFormat?: "text" | "badge" | "datetime" | "custom"`
  - `liveField?: { dataKey, displayFormat, dependencies }`
  - `customComponent?: string`

### 2. **custom-form-field.tsx**
- Added support for new field types
- Integrated `LiveFormField` and `DisplayField` components
- Added `allValues` prop for passing form state to live fields

### 3. **task-confirm-modal.tsx**
- Updated to pass `allValues` (formValues) to CustomFormField
- Enables live fields to access other form values for dependencies

### 4. **task-confirm-modal.config.ts**
- Added Monitor Trip form configuration with:
  - ETA mode selector (calculated/manual)
  - Live ETA display field (shows when mode is "calculated")
  - Manual datetime input (shows when mode is "manual")
- Fixed task type mapping for `TYPE_WFSHIP2_MONITOR_TRIP_TASK`

### 5. **i18n files (en.json, es.json)**
- Added translations for all new fields and states:
  - ETA mode labels
  - Calculated/Manual options
  - Loading/error states
  - Distance display

## Configuration Example

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
      type: "live",
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

## How It Works

1. **User opens Monitor Trip modal**
   - Form initializes with ETA mode set to "calculated"
   - Live ETA field is visible and starts fetching data

2. **In "calculated" mode:**
   - `LiveFormField` component renders
   - `useLiveETA` hook fetches from `/api/task/calculate-eta`
   - Shows loading spinner while fetching
   - Displays formatted ETA with arrival time and duration
   - Auto-refreshes every 60 seconds

3. **In "manual" mode:**
   - Live ETA field hides (conditional visibility)
   - Manual datetime input appears
   - User enters specific arrival time

4. **Form submission:**
   - In calculated mode: ETA is informational (not sent to backend)
   - In manual mode: Sends `prop_mintral_estimatedArrivalDate`
   - Always sends `prop_mintral_etaMode`

## Next Steps

### Required Backend Implementation

1. **Create API endpoint** `/api/task/calculate-eta`:
   ```typescript
   // Needs to call Alfresco proxy which calls PgRest
   POST /api/task/calculate-eta
   Body: {
     originGeofence: string,
     destinationGeofence: string,
     doubleDriver: boolean,
     percentile: string,
     startDate: string
   }
   Response: {
     estimatedArrival: string,
     duration: number,  // in minutes
     distance: number   // in km
   }
   ```

2. **Create Alfresco webscript** to proxy PgRest ETA endpoint
   - Handle authentication
   - Transform parameters to match PgRest format
   - Return standardized response

### Optional Enhancements

1. **Add origin/destination fields** to the form for complete ETA calculation
2. **Implement caching** to reduce API calls
3. **Add more display formats** (e.g., countdown timer)
4. **Support for other live data types** (GPS location, validation status)

## Testing Checklist

- [ ] ETA mode selector renders correctly
- [ ] Live ETA field shows/hides based on mode
- [ ] Manual datetime field shows/hides based on mode
- [ ] Loading state displays while fetching ETA
- [ ] Error state displays on fetch failure
- [ ] ETA refreshes every 60 seconds
- [ ] Form submits correct values based on mode
- [ ] i18n translations work in both languages
- [ ] Dark mode styling works correctly

## Benefits Achieved

1. **Clean SWR Integration**: Hooks and components properly separated
2. **Reusable Components**: Display and live fields can be used elsewhere
3. **Type Safety**: Full TypeScript support maintained
4. **User Experience**: Clear loading/error states, auto-refresh
5. **Flexibility**: Easy to add new live data types
6. **Backward Compatible**: Existing forms continue working unchanged