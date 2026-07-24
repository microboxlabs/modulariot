# Handlebars Helpers Reference

Custom helpers available in all dashboard dashlet templates (info cards, stat cards, text cards, data tables, etc.).

---

## Number Helpers

### `formatNumber`

Formats a number using locale-aware formatting (`Intl.NumberFormat`).

```handlebars
{{formatNumber value}}
{{formatNumber value decimals=2}}
{{formatNumber value decimals=1 locale="en-US"}}
{{formatNumber value prefix="$" suffix=" CLP"}}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `decimals` | number | auto | Fixed number of decimal places |
| `locale` | string | `es-CL` | Locale for formatting (thousands/decimal separators) |
| `prefix` | string | `""` | Text prepended to the result |
| `suffix` | string | `""` | Text appended to the result |

**Examples:**

| Template | Data | Output |
|----------|------|--------|
| `{{formatNumber row.temp}}` | `25.678` | `25,678` |
| `{{formatNumber row.temp decimals=1}}` | `25.678` | `25,7` |
| `{{formatNumber row.temp decimals=2 locale="en-US"}}` | `25.678` | `25.68` |
| `{{formatNumber row.price prefix="$"}}` | `1500` | `$1.500` |
| `{{formatNumber row.temp decimals=1 suffix="C"}}` | `25.678` | `25,7C` |

> **Note:** With locale `es-CL`, the thousands separator is `.` and the decimal separator is `,`.

---

### `extractNumber`

Extracts the first number found in a text string. Useful when sensor data comes with units attached.

```handlebars
{{extractNumber value}}
```

| Template | Data | Output |
|----------|------|--------|
| `{{extractNumber row.reading}}` | `"25.5 kg"` | `25.5` |
| `{{extractNumber row.reading}}` | `"-10 C"` | `-10` |
| `{{extractNumber row.reading}}` | `"1,5 bar"` | `1,5` |
| `{{extractNumber row.reading}}` | `"no numbers"` | `-` |

---

### `toFixed`

Rounds a number to a fixed number of decimal places (no locale formatting, uses `.` as decimal separator).

```handlebars
{{toFixed value decimals}}
```

| Template | Data | Output |
|----------|------|--------|
| `{{toFixed row.temp 2}}` | `25.678` | `25.68` |
| `{{toFixed row.temp 0}}` | `25.678` | `26` |
| `{{toFixed row.temp 4}}` | `25.6` | `25.6000` |

---

### `round`

Rounds a number to the nearest integer.

```handlebars
{{round value}}
```

| Template | Data | Output |
|----------|------|--------|
| `{{round row.temp}}` | `25.6` | `26` |
| `{{round row.temp}}` | `25.4` | `25` |

---

### `multiply`

Multiplies a value by a factor. Common use: converting ratios to percentages.

```handlebars
{{multiply value factor}}
```

| Template | Data | Output |
|----------|------|--------|
| `{{multiply row.ratio 100}}%` | `0.85` | `85%` |
| `{{multiply row.value 2}}` | `50` | `100` |

---

### `divide`

Divides a value by a divisor. Returns `-` if divisor is zero.

```handlebars
{{divide value divisor}}
```

| Template | Data | Output |
|----------|------|--------|
| `{{divide row.bytes 1024}} KB` | `2048` | `2 KB` |
| `{{divide row.total 3}}` | `9` | `3` |
| `{{divide row.value 0}}` | `10` | `-` |

---

## Date Helpers

### `formatDate`

Formats a date string using locale-aware formatting (`Intl.DateTimeFormat`).

```handlebars
{{formatDate value}}
{{formatDate value format="date"}}
{{formatDate value format="time"}}
{{formatDate value format="relative"}}
{{formatDate value format="date" locale="en-US" timezone="UTC"}}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `datetime` | One of: `date`, `time`, `datetime`, `relative` |
| `locale` | string | `es-CL` | Locale for formatting |
| `timezone` | string | `America/Santiago` | IANA timezone |

**Format modes:**

| Format | Description | Example Output |
|--------|-------------|----------------|
| `date` | Date only (DD-MM-YYYY) | `15-06-2025` |
| `time` | Time only (HH:MM, 24h) | `14:30` |
| `datetime` | Full date and time | `15-06-2025, 14:30` |
| `relative` | Human-readable relative time | `3h`, `2d`, `15 jun` |

**Examples:**

| Template | Data | Output |
|----------|------|--------|
| `{{formatDate row.created_at format="date"}}` | `"2025-06-15T14:30:00Z"` | `15-06-2025` |
| `{{formatDate row.created_at format="time"}}` | `"2025-06-15T14:30:00Z"` | `10:30` |
| `{{formatDate row.created_at format="relative"}}` | *(3 hours ago)* | `3h` |
| `{{formatDate row.created_at}}` | `"2025-06-15T14:30:00Z"` | `15-06-2025, 10:30` |

> **Note:** Times are converted to the `America/Santiago` timezone by default.

---

### `datePart`

Extracts a specific part from a date.

```handlebars
{{datePart value "part"}}
```

| Part | Description | Example Output |
|------|-------------|----------------|
| `year` | Four-digit year | `2025` |
| `month` | Two-digit month | `06` |
| `day` | Two-digit day | `15` |
| `hour` | Two-digit hour (24h) | `10` |
| `minute` | Two-digit minute | `30` |
| `weekday` | Full weekday name | `domingo` |

**Examples:**

| Template | Data | Output |
|----------|------|--------|
| `{{datePart row.created_at "year"}}` | `"2025-06-15T14:30:00Z"` | `2025` |
| `{{datePart row.created_at "month"}}` | `"2025-06-15T14:30:00Z"` | `06` |
| `{{datePart row.created_at "day"}}` | `"2025-06-15T14:30:00Z"` | `15` |
| `{{datePart row.created_at "weekday"}}` | `"2025-06-15T14:30:00Z"` | `domingo` |

> **Note:** Weekday names are returned in the default locale (`es-CL`), so they appear in Spanish.

---

### `timeAgo`

Returns a human-readable "time ago" string.

```handlebars
{{timeAgo value}}
```

| Time Difference | Output |
|-----------------|--------|
| < 1 minute | `just now` |
| 5 minutes | `5m ago` |
| 2 hours | `2h ago` |
| 3 days | `3d ago` |
| 2 months | `2mo ago` |
| 1 year | `1y ago` |
| Future dates | `5m from now` |

**Examples:**

| Template | Output |
|----------|--------|
| `{{timeAgo row.last_seen}}` | `5m ago` |
| `{{timeAgo row.created_at}}` | `3d ago` |

---

## Combining Helpers

Helpers can be mixed with plain text and other Handlebars expressions in the same template:

```handlebars
{{formatNumber row.temperature decimals=1}}C at {{formatDate row.timestamp format="time"}}
```
Output: `25,7C at 14:30`

```handlebars
Last reading: {{formatNumber row.value decimals=2}} ({{timeAgo row.updated_at}})
```
Output: `Last reading: 42,50 (5m ago)`

```handlebars
{{datePart row.created_at "day"}}/{{datePart row.created_at "month"}}/{{datePart row.created_at "year"}}
```
Output: `15/06/2025`

---

## Error Handling

All helpers return `-` when the input is `null`, `undefined`, empty, or invalid:

| Scenario | Output |
|----------|--------|
| `{{formatNumber row.missing}}` | `-` |
| `{{formatDate row.missing}}` | `-` |
| `{{formatNumber "abc"}}` | `-` |
| `{{formatDate "not-a-date"}}` | `-` |
| `{{divide row.value 0}}` | `-` |

---

## Data Sources

Helpers work with any value in the template context:

```handlebars
{{!-- From database row --}}
{{formatNumber row.temperature decimals=1}}

{{!-- From data provider --}}
{{formatNumber data_provider.sensor_value decimals=2}}

{{!-- From filter --}}
{{formatDate filter.start_date format="date"}}

{{!-- Direct root property --}}
{{formatNumber temperature decimals=1}}
```
