"use client";

import { useState, useEffect, useRef } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { renameBentoFile } from "@/features/common/providers/client-api.provider";
import { toast } from "sonner";

export function EditableFileName({
  currentName,
  nodeId,
  onRenamed,
  dictionary,
  inputClassName,
  spanClassName,
}: Readonly<{
  currentName: string;
  nodeId: string | undefined;
  onRenamed?: () => void;
  dictionary: I18nRecord;
  inputClassName: string;
  spanClassName: string;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditing(false);
    setEditedName(currentName);
  }, [currentName]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleBlur = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== currentName && nodeId) {
      const renamePromise = renameBentoFile(nodeId, trimmed);
      toast.promise(renamePromise, {
        loading: tr("bento.multimedia.rename_loading", dictionary),
        success: tr("bento.multimedia.rename_success", dictionary),
        error: tr("bento.multimedia.rename_error", dictionary),
      });
      renamePromise.then(() => onRenamed?.()).catch(() => {
        setEditedName(currentName);
      });
    } else {
      setEditedName(currentName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") {
      setEditedName(currentName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title={tr("bento.multimedia.viewer_click_rename", dictionary)}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsEditing(true); }}
      className={spanClassName}
    >
      {editedName || currentName}
    </span>
  );
}
