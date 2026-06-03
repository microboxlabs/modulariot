export type EndTaskProcessVariablesField = {
  carrier_id: string;
  driver_id: string;
  driver2_id: string | null;
  truck_id: string;
  trailer_id: string | null;
  carrier_external_id: string | null;
  tipo_servicio: string;
};

export type EndTaskRequest = {
  taskId: string;
  transitionId?: string;
  bpm_package?: string;
  comments?: string;
  nativeGenerationEnabled?: string;
  reason?: string;
  reasonId?: string;
  reasons?: string; // JSON stringified array for multi-select
  isMultiReason?: string; // Flag to indicate multi-select mode
  /**
   * Optional process-scope variables for the planner's task-driven ASSIGN
   * move. When present, the route POSTs to the ECM endTask webscript with
   * a `processVariables` body and skips the kanban `updateTask` step (the
   * planner has no form fields to write — the resource tuple is what
   * travels). See `docs/plans/calendar-task-driven-frontend-P0-spike.md`
   * §2.2 for the wire shape.
   */
  processVariables?: EndTaskProcessVariablesField;
  // Allow any additional fields from dynamic forms
  [key: string]: unknown;
};

export type UpdateTaskRequest = {
  prop_bpm_comment?: string;
  prop_mintral_shouldBuildManifest?: "true" | "false";
  prop_mintral_commentPostTitle?: string;
  prop_mintral_commentPostContent?: string;
  prop_cm_owner?: string;
  // New properties for multi-select rejection handling
  prop_mintral_commentReasons?: string[];
  // Allow any additional prop_* fields from dynamic forms
  [key: string]: unknown;
};
