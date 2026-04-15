"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiCloudArrowUp, HiCheckCircle, HiExclamationCircle } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { buildDataSourceParams } from "../common/pgrest-utils";

export interface DashletConfig {
  title: string;
  pgrestFunctionName: string;
  dataSourceId?: string;
  acceptedFileTypes?: string;
}

export const defaultConfig: DashletConfig = {
  title: "Upload File",
  pgrestFunctionName: "",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "success"; fileName: string }
  | { status: "error"; message: string };

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });

  useEffect(() => {
    if (uploadState.status === "success") {
      const timer = setTimeout(() => setUploadState({ status: "idle" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadState.status]);

  const handleUpload = useCallback(async (file: File) => {
    if (!config.pgrestFunctionName) {
      setUploadState({ status: "error", message: "No endpoint configured" });
      return;
    }

    setUploadState({ status: "uploading", fileName: file.name });

    try {
      const dsParams = buildDataSourceParams(config.dataSourceId);
      dsParams.set("functionName", config.pgrestFunctionName);
      const url = `/app/api/dashboard/pgrest/upload?${dsParams.toString()}`;

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(url, { method: "POST", body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setUploadState({ status: "success", fileName: file.name });
    } catch (err) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }, [config.pgrestFunctionName, config.dataSourceId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }, [handleUpload]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const isConfigured = !!config.pgrestFunctionName;

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={config.acceptedFileTypes || undefined}
        onChange={handleFileChange}
      />

      {!isConfigured && (
        <p className="text-sm text-gray-400">Configure an endpoint in settings</p>
      )}

      {isConfigured && uploadState.status === "idle" && (
        <Button color="blue" onClick={handleClick} className="gap-2">
          <HiCloudArrowUp className="mr-2 h-5 w-5" />
          {config.title || "Upload File"}
        </Button>
      )}

      {uploadState.status === "uploading" && (
        <div className="flex flex-col items-center gap-2">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Uploading {uploadState.fileName}...
          </p>
        </div>
      )}

      {uploadState.status === "success" && (
        <div className="flex flex-col items-center gap-2">
          <HiCheckCircle className="h-8 w-8 text-green-500" />
          <p className="text-sm text-green-600 dark:text-green-400">
            {uploadState.fileName} uploaded
          </p>
        </div>
      )}

      {uploadState.status === "error" && (
        <div className="flex flex-col items-center gap-2">
          <HiExclamationCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">{uploadState.message}</p>
          <Button color="gray" size="xs" onClick={() => setUploadState({ status: "idle" })}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
