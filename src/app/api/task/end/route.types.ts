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
  prop_mintral_commentPostTitle?: string;
  prop_mintral_commentPostContent?: string;
  prop_cm_owner?: string;
};
