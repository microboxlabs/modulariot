export type EndTaskRequest = {
  taskId: string;
  transitionId?: string;
  comments?: string;
  nativeGenerationEnabled?: string;
  reason?: string;
  reasonId?: string;
};

export type UpdateTaskRequest = {
  prop_bpm_comment?: string;
  prop_mintral_shouldBuildManifest?: "true" | "false";
  prop_wfship_sovosDigitalSignatureOutputReasonType?: string;
  prop_wfship_transportValidationOutputReasonType?: string;
  prop_wfship_missionControlValidationOutputReasonType?: string;
  prop_cm_owner?: string;
};
