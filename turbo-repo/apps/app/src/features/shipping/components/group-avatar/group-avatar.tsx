import { Tooltip } from "flowbite-react";
import type { KanbanTaskGroup } from "../../types/common.types";

interface GroupAvatarProps {
  group?: KanbanTaskGroup;
  size?: number;
}

/** Stable hue (0–359) derived from the group key, so a group always gets the
 * same colour without needing a configured palette. */
function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renders a pooled task's candidate **group** as a coloured initials badge.
 * Shipping tasks have no single assignee, so the group — not a person — is the
 * accurate owner to surface. Renders nothing when no group is available.
 */
export function GroupAvatar({ group, size = 28 }: GroupAvatarProps) {
  if (!group) {
    return null;
  }
  const hue = hashHue(group.id || group.name);
  return (
    <Tooltip content={group.name}>
      <span
        aria-label={group.name}
        className="inline-flex items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white dark:ring-gray-800"
        style={{
          width: size,
          height: size,
          backgroundColor: `hsl(${hue} 60% 45%)`,
        }}
      >
        {groupInitials(group.name)}
      </span>
    </Tooltip>
  );
}
