export type SeverityLevel = {
  code: number;
  key: string;
  en: string;
  es: string;
  color: string;
  description: string;
};

export const SEV: SeverityLevel[] = [
  {
    code: 0,
    key: "estable",
    es: "Estable",
    en: "Stable",
    color: "#0E9F6E",
    description: "Baseline — no issue detected.",
  },
  {
    code: 1,
    key: "en-observacion",
    es: "En observación",
    en: "Under observation",
    color: "#3F83F8",
    description: "Early signal — worth keeping an eye on.",
  },
  {
    code: 2,
    key: "comprometida",
    es: "Comprometida",
    en: "Compromised",
    color: "#F59E0B",
    description: "Needs attention soon.",
  },
  {
    code: 3,
    key: "alerta-critica",
    es: "Crítica",
    en: "Critical",
    color: "#F05252",
    description: "Urgent — act now.",
  },
  {
    code: 4,
    key: "codigo-negro",
    es: "Código negro",
    en: "Code black",
    color: "#111928",
    description: "Worst case — immediate response required.",
  },
];

export function sevByCode(code: number): SeverityLevel {
  return SEV.find((sev) => sev.code === code) ?? SEV[0];
}

export type CategoryId = "gps_metrics" | "trip_planning" | "event" | "sensor";

export type Category = {
  id: CategoryId;
  label: string;
  short: string;
  order: number;
};

export const CATS: Record<CategoryId, Category> = {
  gps_metrics: {
    id: "gps_metrics",
    label: "Ready now",
    short: "GPS & metrics",
    order: 1,
  },
  trip_planning: {
    id: "trip_planning",
    label: "Needs trip data",
    short: "Trip planning",
    order: 2,
  },
  event: {
    id: "event",
    label: "Needs an event source",
    short: "Events",
    order: 3,
  },
  sensor: { id: "sensor", label: "Advanced", short: "Sensors", order: 4 },
};

// ── Editable configuration parameters ──────────────────────────────────────

export type ParamUi = "number" | "tri_state" | "select" | "time";

export type VitalSignParam = {
  key: string;
  label: string;
  ui: ParamUi;
  defaultValue: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
};

export type ThresholdOperator = ">" | ">=" | "<" | "<=";

export type ThresholdRow = {
  severityCode: number;
  operator: ThresholdOperator;
  value: number;
};

// The activation ladder for a single comparable variable: at which value
// (and comparison) each severity state turns on. Rows are ascending by
// severity; anything below the lowest row's threshold stays Stable.
export type ConditionBuilder = {
  variableLabel: string;
  unit: string;
  rows: ThresholdRow[];
};

const SPEED_CONDITION: ConditionBuilder = {
  variableLabel: "Speed over limit",
  unit: "km/h",
  rows: [
    { severityCode: 2, operator: ">=", value: 5 },
    { severityCode: 3, operator: ">=", value: 11 },
    { severityCode: 4, operator: ">", value: 21 },
  ],
};

const DURATION_CONDITION: ConditionBuilder = {
  variableLabel: "Continuous drive duration",
  unit: "min",
  rows: [
    { severityCode: 2, operator: ">=", value: 300 },
    { severityCode: 3, operator: ">=", value: 330 },
    { severityCode: 4, operator: ">=", value: 360 },
  ],
};

export type VitalSign = {
  id: number;
  key: string;
  name: string;
  desc: string;
  /** Longer markdown write-up shown in the card's expanded panel — what it
   * watches, why it matters, and what makes it fire. */
  about: string;
  cat: CategoryId;
  ready: boolean;
  missing?: string;
  ceiling: number;
  params: VitalSignParam[];
  condition?: ConditionBuilder;
};

export const SYMPTOMS: VitalSign[] = [
  // Category A — GPS / metrics only · Ready now
  {
    id: 5,
    key: "speed_limit",
    name: "Over the speed limit",
    desc: "Flags vehicles exceeding the speed limit.",
    about:
      "Watches GPS speed against the posted limit and raises severity the further **over** the vehicle goes.\n\nUseful for catching risky driving before it becomes an incident — especially on routes with sharp turns or school zones.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 4,
    params: [
      {
        key: "speed_over_limit_kmh",
        label: "Speed over limit",
        ui: "number",
        defaultValue: "5",
        unit: "km/h",
        min: 0,
        max: 200,
      },
    ],
    condition: SPEED_CONDITION,
  },
  {
    id: 9,
    key: "lost_signal",
    name: "Device went dark",
    desc: "No telemetry received for too long.",
    about:
      "Fires when a tracker stops reporting position for longer than expected — a dead battery, a jammed signal, or someone deliberately disconnecting the device.\n\n**Why it matters:** a silent asset is an unmonitored asset.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 3,
    params: [
      {
        key: "max_duration_seconds",
        label: "No-signal window",
        ui: "number",
        defaultValue: "1800",
        unit: "seconds",
        min: 60,
        max: 604800,
      },
    ],
  },
  {
    id: 7,
    key: "continuous_drive",
    name: "Driving too long without a break",
    desc: "Driver exceeds continuous driving time.",
    about:
      "Tracks how long a driver has been moving without a qualifying rest stop, and escalates the longer they push past the limit.\n\nHelps enforce fatigue-management policy and hours-of-service compliance.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 4,
    params: [
      {
        key: "continuous_drive_limit_seconds",
        label: "Continuous drive limit",
        ui: "number",
        defaultValue: "14400",
        unit: "seconds",
        min: 0,
        max: 86400,
      },
      {
        key: "detention_valid_period_seconds",
        label: "Valid break length",
        ui: "number",
        defaultValue: "900",
        unit: "seconds",
        min: 0,
        max: 86400,
      },
    ],
    condition: DURATION_CONDITION,
  },
  {
    id: 8,
    key: "continuous_resting",
    name: "Resting too long / stalled",
    desc: "Asset idle/resting beyond expected period.",
    about:
      "Flags a vehicle that has stayed stationary well past a normal rest stop — could be a breakdown, an unplanned detour, or simply a driver running behind schedule.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 2,
    params: [
      {
        key: "valid_rest_seconds",
        label: "Rest closes tracking after",
        ui: "number",
        defaultValue: "3600",
        unit: "seconds",
        min: 0,
        max: 172800,
      },
    ],
  },
  {
    id: 2,
    key: "off_hours_driving",
    name: "Moving outside allowed hours",
    desc: "Movement detected outside the allowed schedule.",
    about:
      "Compares GPS movement against your configured operating window and flags anything that happens **before or after hours**.\n\nGood for catching unauthorized use of a vehicle outside its shift.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 3,
    params: [
      {
        key: "start_hour",
        label: "Allowed from",
        ui: "time",
        defaultValue: "06:00",
      },
      {
        key: "end_hour",
        label: "Allowed until",
        ui: "time",
        defaultValue: "22:00",
      },
    ],
  },
  {
    id: 3,
    key: "night_risk_stay",
    name: "Night driving / overnight in risk zone",
    desc: "Driving at night or stopping overnight in a risk zone.",
    about:
      "Watches for night-time travel through, or overnight stops inside, a designated risk zone — the combination that correlates most with cargo theft and hijacking.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 3,
    params: [
      {
        key: "evaluate_geofence_schedule",
        label: "Respect zone schedule",
        ui: "tri_state",
        defaultValue: "yes",
      },
    ],
  },
  {
    id: 4,
    key: "risk_zone_stop",
    name: "Stopped in a risk zone",
    desc: "Asset stopped inside a designated risk zone.",
    about:
      "Fires any time a vehicle stops — even briefly — inside a geofenced risk, urban, or border zone.\n\nUnexpected stops in these areas are one of the earliest signals of a hijacking attempt.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 3,
    params: [
      {
        key: "in_geofence_type",
        label: "Risk zone type",
        ui: "select",
        defaultValue: "risk",
        options: [
          { value: "risk", label: "Risk zone" },
          { value: "urban", label: "Urban" },
          { value: "border", label: "Border" },
        ],
      },
    ],
  },
  {
    id: 1,
    key: "bad_sign",
    name: "Bad / implausible telemetry",
    desc: "Data-quality watchdog for implausible signals.",
    about:
      "A sanity check on the incoming data itself — teleporting positions, impossible speeds, or other physically-implausible readings.\n\nLow ceiling on purpose: it's a data-quality signal, not an operational alarm.",
    cat: "gps_metrics",
    ready: true,
    ceiling: 1,
    params: [],
  },
  {
    id: 30,
    key: "vehicle_maintenance",
    name: "Engine health (coolant, AdBlue, DPF)",
    desc: "Engine telemetry outside healthy limits.",
    about:
      "Rolls up coolant temperature, AdBlue level, and DPF soot load into one vital sign — the three engine metrics most likely to strand a vehicle if ignored.\n\n*Requires engine telemetry to be connected.*",
    cat: "gps_metrics",
    ready: false,
    missing: "engine metrics",
    ceiling: 4,
    params: [
      {
        key: "coolant_temp_c_min",
        label: "Coolant temperature",
        ui: "number",
        defaultValue: "95",
        unit: "°C",
        min: -40,
        max: 150,
      },
      {
        key: "adblue_level_min_percent",
        label: "AdBlue level",
        ui: "number",
        defaultValue: "10",
        unit: "%",
        min: 0,
        max: 100,
      },
      {
        key: "dpf_soot_load_min_percent",
        label: "DPF soot load",
        ui: "number",
        defaultValue: "80",
        unit: "%",
        min: 0,
        max: 100,
      },
    ],
  },
  {
    id: 31,
    key: "engine_idle",
    name: "Excessive engine idling",
    desc: "Engine running idle beyond threshold.",
    about:
      "Flags an engine left running while the vehicle isn't moving for longer than the configured limit — wasted fuel, extra wear, and unnecessary emissions.\n\n*Requires engine telemetry to be connected.*",
    cat: "gps_metrics",
    ready: false,
    missing: "engine metrics",
    ceiling: 2,
    params: [
      {
        key: "max_duration_seconds",
        label: "Idle limit",
        ui: "number",
        defaultValue: "600",
        unit: "seconds",
        min: 0,
        max: 86400,
      },
    ],
  },
  {
    id: 32,
    key: "harsh_braking",
    name: "Harsh braking / rough driving",
    desc: "Harsh braking and aggressive driving events.",
    about:
      "Picks up sudden braking, sharp acceleration, and other aggressive-driving events from the accelerometer.\n\nA good early indicator of both driver coaching needs and cargo-damage risk.\n\n*Requires an accelerometer-equipped device.*",
    cat: "gps_metrics",
    ready: false,
    missing: "accelerometer",
    ceiling: 2,
    params: [],
  },

  // Category B — GPS + trip planning · Needs trip data
  {
    id: 6,
    key: "speed_limit_custom",
    name: "Over the route's speed limit",
    desc: "Exceeds the planned route's speed limit.",
    about:
      "Same idea as the general speed check, but measured against the **speed limits of the actual planned route** instead of a flat threshold — catches segment-specific limits a generic check would miss.\n\n*Requires planned route data.*",
    cat: "trip_planning",
    ready: false,
    missing: "route speed limits",
    ceiling: 4,
    params: [
      {
        key: "speed_over_limit_kmh",
        label: "Speed over route limit",
        ui: "number",
        defaultValue: "5",
        unit: "km/h",
        min: 0,
        max: 200,
      },
    ],
    condition: SPEED_CONDITION,
  },
  {
    id: 15,
    key: "eta_late",
    name: "Running late vs. plan",
    desc: "Trip running behind the planned ETA.",
    about:
      "Compares live position against the planned ETA and flags trips falling meaningfully behind schedule — early warning for customers waiting on a delivery.\n\n*Requires planned ETA data.*",
    cat: "trip_planning",
    ready: false,
    missing: "planned ETAs",
    ceiling: 3,
    params: [
      {
        key: "eta_late",
        label: "Late threshold",
        ui: "number",
        defaultValue: "1800",
        unit: "seconds",
        min: 0,
        max: 86400,
      },
    ],
  },
  {
    id: 14,
    key: "eta_early",
    name: "Arriving suspiciously early",
    desc: "Trip arriving earlier than planned.",
    about:
      "The mirror image of running late — a trip arriving well ahead of its planned ETA, which can point to route shortcuts, missed stops, or unsafe average speeds.\n\n*Requires planned ETA data.*",
    cat: "trip_planning",
    ready: false,
    missing: "planned ETAs",
    ceiling: 2,
    params: [
      {
        key: "eta_early",
        label: "Early threshold",
        ui: "number",
        defaultValue: "1800",
        unit: "seconds",
        min: 0,
        max: 86400,
      },
    ],
  },
  {
    id: 12,
    key: "double_driver",
    name: "Two-driver rotation not respected",
    desc: "Required driver rotation not honored.",
    about:
      "For trips that require two drivers rotating shifts, this checks that the rotation is actually happening within the maximum allowed stretch without rest.\n\n*Requires driver assignment data.*",
    cat: "trip_planning",
    ready: false,
    missing: "driver assignment",
    ceiling: 3,
    params: [
      {
        key: "double_driver",
        label: "Requires two drivers",
        ui: "tri_state",
        defaultValue: "yes",
      },
      {
        key: "max_time_in_trip_without_rest_seconds",
        label: "Max trip without rest",
        ui: "number",
        defaultValue: "36000",
        unit: "seconds",
        min: 0,
        max: 604800,
      },
    ],
  },

  // Category C — Event-dependent · Needs an event source
  {
    id: 10,
    key: "load_securing",
    name: "Load not secured",
    desc: "Load-securing absence event (AAS).",
    about:
      "Listens for the load-securing-absence (AAS) event from the cargo-monitoring feed — a direct signal that cargo isn't properly restrained.\n\n*Requires an AAS event feed integration.*",
    cat: "event",
    ready: false,
    missing: "AAS event feed",
    ceiling: 4,
    params: [
      {
        key: "tipo_evento",
        label: "Event type",
        ui: "select",
        defaultValue: "AAS",
        options: [{ value: "AAS", label: "AAS" }],
      },
    ],
  },
  {
    id: 20,
    key: "restricted_area",
    name: "Entered a forbidden area",
    desc: "Restricted-area crossing event (CANP).",
    about:
      "Listens for the restricted-area-crossing (CANP) event — fires the moment an asset enters a zone it's explicitly not allowed into.\n\n*Requires a CANP event feed integration.*",
    cat: "event",
    ready: false,
    missing: "CANP event feed",
    ceiling: 4,
    params: [
      {
        key: "out_geofence_type",
        label: "Forbidden zone type",
        ui: "select",
        defaultValue: "restricted",
        options: [{ value: "restricted", label: "Restricted" }],
      },
    ],
  },
  {
    id: 18,
    key: "sos_button",
    name: "Driver pressed SOS",
    desc: "Driver triggered the SOS panic button.",
    about:
      "The most direct alert in the system: the driver hit the physical panic button. Treat any trigger as urgent until confirmed otherwise.\n\n*Requires SOS-capable hardware.*",
    cat: "event",
    ready: false,
    missing: "SOS-capable hardware",
    ceiling: 4,
    params: [],
  },
  {
    id: 19,
    key: "assistance_button",
    name: "Driver requested assistance",
    desc: "Driver requested assistance.",
    about:
      "A lower-urgency companion to the SOS button — for when a driver needs help but it isn't an emergency (a flat tire, feeling unwell, needing directions).\n\n*Requires assistance-button hardware.*",
    cat: "event",
    ready: false,
    missing: "button hardware",
    ceiling: 2,
    params: [],
  },

  // Category D — Sensor fusion · Advanced
  {
    id: 17,
    key: "fatigue_sensor",
    name: "Driver fatigue (camera)",
    desc: "Driver-monitoring camera detects fatigue.",
    about:
      "Uses a driver-monitoring (DMS) camera to detect signs of drowsiness directly — eye closure, head nodding — rather than inferring it from driving behavior.\n\n*Requires a DMS camera.*",
    cat: "sensor",
    ready: false,
    missing: "DMS camera",
    ceiling: 4,
    params: [],
  },
  {
    id: 16,
    key: "fatigue_inferred",
    name: "Driver fatigue (inferred)",
    desc: "Fatigue inferred from driving patterns.",
    about:
      "Estimates fatigue from driving-pattern signals (lane drift, inconsistent speed, erratic steering) when there's no dedicated fatigue camera installed.\n\nLess precise than camera-based detection, but works with existing hardware.\n\n*Requires driving-pattern data.*",
    cat: "sensor",
    ready: false,
    missing: "driving patterns",
    ceiling: 3,
    params: [],
  },
];

export type Profile = {
  id: string;
  label: string;
  desc: string;
  bundle: string[];
};

export const PROFILES: Profile[] = [
  {
    id: "mining",
    label: "Mining logistics",
    desc: "Heavy haul, risk zones, faena schedules",
    bundle: [
      "speed_limit",
      "lost_signal",
      "continuous_drive",
      "risk_zone_stop",
      "night_risk_stay",
      "off_hours_driving",
      "speed_limit_custom",
      "load_securing",
      "restricted_area",
    ],
  },
  {
    id: "distribution",
    label: "Distribution",
    desc: "Last-mile & regional delivery, ETAs",
    bundle: [
      "speed_limit",
      "lost_signal",
      "continuous_drive",
      "off_hours_driving",
      "eta_late",
      "eta_early",
      "harsh_braking",
    ],
  },
  {
    id: "leasing",
    label: "Passenger / Leasing",
    desc: "Driver behavior & vehicle health",
    bundle: [
      "speed_limit",
      "lost_signal",
      "continuous_drive",
      "harsh_braking",
      "vehicle_maintenance",
      "fatigue_sensor",
    ],
  },
  {
    id: "custom",
    label: "Custom",
    desc: "Start from scratch, pick your own",
    bundle: [],
  },
];

export const DEFAULT_PROFILE_ID = "mining";

export function isProfileId(value: string | undefined): value is string {
  return PROFILES.some((profile) => profile.id === value);
}

/** Vital signs that are both ready and part of the given profile's bundle —
 * the ones that turn on by default and surface in the "Recommended" section. */
export function recommendedReadySymptoms(profileId: string): VitalSign[] {
  const bundle = new Set(
    PROFILES.find((profile) => profile.id === profileId)?.bundle ?? []
  );
  return SYMPTOMS.filter((symptom) => symptom.ready && bundle.has(symptom.key));
}
