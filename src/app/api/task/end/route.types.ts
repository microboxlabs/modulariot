export type EndTaskRequest = {
  taskId: string;
  transitionId?: string;
  comments?: string;
  nativeGenerationEnabled?: string;
  reason?: string;
  reasonId?: string;
  reasons?: string; // JSON stringified array for multi-select
  isMultiReason?: string; // Flag to indicate multi-select mode
};

export type UpdateTaskRequest = {
  prop_bpm_comment?: string;
  prop_mintral_shouldBuildManifest?: "true" | "false";
  prop_mintral_commentPostTitle?: string;
  prop_mintral_commentPostContent?: string;
  prop_cm_owner?: string;
  // New properties for multi-select rejection handling
  prop_mintral_rejectionReasons?: string;
  prop_mintral_rejectionCount?: string;
  prop_mintral_isMultiRejection?: string;
};
