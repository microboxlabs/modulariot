"use client";
import { useId, useState } from "react";
import {
  DASHBOARD_ROLES,
  isDashboardRole,
  type DashboardRole,
} from "@microboxlabs/miot-dashboard-contract/roles";

export interface PermissionAssignment {
  readonly authorityId: string;
  readonly role: DashboardRole;
}
export interface PermissionAuthorityOption {
  readonly id: string;
  readonly label: string;
}
export interface PermissionAssignmentEditorProps {
  readonly assignments: readonly PermissionAssignment[];
  /** Only identities the host permits this caller to discover. */
  readonly authorities: readonly PermissionAuthorityOption[];
  /** Updates a host-owned draft; persist separately through client.setPermissions. */
  readonly onChange: (assignments: PermissionAssignment[]) => void;
  /** Derive from server canManagePermissions, not from a role-name assumption. */
  readonly editable?: boolean;
  readonly disabled?: boolean;
  readonly labels: {
    readonly authority: string;
    readonly role: string;
    readonly choose: string;
    readonly add: string;
    readonly remove: string;
    readonly empty: string;
    readonly roles: Readonly<Record<DashboardRole, string>>;
  };
}

/** Controlled assignment draft. No identity lookup, credentials or network requests. */
export function PermissionAssignmentEditor({
  assignments,
  authorities,
  onChange,
  editable = false,
  disabled = false,
  labels,
}: PermissionAssignmentEditorProps) {
  const id = useId();
  const [authorityId, setAuthorityId] = useState("");
  const [role, setRole] = useState<DashboardRole>("Consumer");
  const available = authorities.filter(
    (authority) =>
      !assignments.some((item) => item.authorityId === authority.id),
  );
  const canWrite = editable && !disabled;
  const canAdd = canWrite && available.some((item) => item.id === authorityId);
  function add() {
    if (!canAdd) return;
    onChange([...assignments, { authorityId, role }]);
    setAuthorityId("");
  }
  function changeRole(index: number, next: string) {
    if (!canWrite || !isDashboardRole(next)) return;
    onChange(
      assignments.map((item, i) =>
        i === index ? { ...item, role: next } : { ...item },
      ),
    );
  }
  function remove(index: number) {
    if (canWrite) onChange(assignments.filter((_, i) => i !== index));
  }
  return (
    <div className="miot-permission-editor">
      {assignments.length === 0 && <p>{labels.empty}</p>}
      <ul>
        {assignments.map((item, index) => {
          const name =
            authorities.find((option) => option.id === item.authorityId)
              ?.label ?? item.authorityId;
          return (
            <li key={item.authorityId}>
              <span>{name}</span>
              <select
                aria-label={`${labels.role}: ${name}`}
                value={item.role}
                disabled={!canWrite}
                onChange={(event) => changeRole(index, event.target.value)}
              >
                {DASHBOARD_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {labels.roles[value]}
                  </option>
                ))}
              </select>
              {editable && (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${labels.remove}: ${name}`}
                  onClick={() => remove(index)}
                >
                  {labels.remove}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <fieldset disabled={disabled}>
          <label htmlFor={`${id}-authority`}>{labels.authority}</label>
          <select
            id={`${id}-authority`}
            value={
              available.some((item) => item.id === authorityId)
                ? authorityId
                : ""
            }
            onChange={(event) => setAuthorityId(event.target.value)}
          >
            <option value="">{labels.choose}</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-role`}>{labels.role}</label>
          <select
            id={`${id}-role`}
            value={role}
            onChange={(event) => {
              if (isDashboardRole(event.target.value))
                setRole(event.target.value);
            }}
          >
            {DASHBOARD_ROLES.map((value) => (
              <option key={value} value={value}>
                {labels.roles[value]}
              </option>
            ))}
          </select>
          <button type="button" disabled={!canAdd} onClick={add}>
            {labels.add}
          </button>
        </fieldset>
      )}
    </div>
  );
}
