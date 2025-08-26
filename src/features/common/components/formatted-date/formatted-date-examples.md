# FormattedDate Component Usage Examples

## Basic Usage

```tsx
import { FormattedDate, FormattedDateOnly, FormattedTimeOnly, FormattedRelative } from "@/features/common/components/formatted-date";

// Default datetime format (24-hour)
<FormattedDate date="2024-01-15T14:30:00Z" />
// Output: 15/01/2024, 14:30

// Date only
<FormattedDate date="2024-01-15T14:30:00Z" format="date" />
// Output: 15/01/2024

// Time only (24-hour format)
<FormattedDate date="2024-01-15T14:30:00Z" format="time" />
// Output: 14:30

// Relative time
<FormattedDate date="2024-01-15T14:30:00Z" format="relative" />
// Output: 2h (if 2 hours ago)

// Convenience components
<FormattedDateOnly date="2024-01-15T14:30:00Z" />
<FormattedTimeOnly date="2024-01-15T14:30:00Z" />
<FormattedRelative date="2024-01-15T14:30:00Z" />
```

## Input Types Handled

```tsx
// String dates
<FormattedDate date="2024-01-15T14:30:00Z" />
<FormattedDate date="2024-01-15" />
<FormattedDate date="14:30" />

// Date objects
<FormattedDate date={new Date()} />

// Timestamps
<FormattedDate date={1705327800000} />

// Null/undefined (shows fallback)
<FormattedDate date={null} fallback="No date" />
<FormattedDate date={undefined} />

// Empty strings
<FormattedDate date="" />
```

## Customization

```tsx
// Custom locale and timezone
<FormattedDate 
  date="2024-01-15T14:30:00Z" 
  locale="en-US" 
  timeZone="America/New_York" 
/>

// Custom styling
<FormattedDate 
  date="2024-01-15T14:30:00Z" 
  className="text-blue-600 font-bold" 
/>

// Custom fallback
<FormattedDate 
  date={null} 
  fallback="Fecha no disponible" 
/>
```

## Features

- ✅ **24-hour time format** (14:30 instead of 2:30 PM)
- ✅ **Multiple input types** (string, Date, number, null, undefined)
- ✅ **Safe error handling** with fallbacks
- ✅ **Multiple output formats** (date, time, datetime, relative)
- ✅ **Internationalization support** with locale and timezone
- ✅ **Accessibility** with title attribute showing original value
- ✅ **TypeScript support** with proper typing
- ✅ **Chilean locale default** (es-CL) with Santiago timezone
