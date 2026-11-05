"use client";

import { useEffect, useState } from "react";
import CelEditor, {
  type CelField,
  type CelProblem,
} from "@/features/symptoms/maintainer/cel-editor";
import {
  checkExpression,
  useMonitorSchema,
  type ParamValue,
  type SchemaField,
  type Trigger,
} from "./monitors-api";

const CHECK_DELAY_MS = 400;

/**
 * The schema as editor fields. A list (`mandates[].status`) completes at its
 * root only: its items are read inside `exists` or `all`.
 */
export function editorFields(schema: SchemaField[] | undefined): CelField[] {
  const out = new Map<string, CelField>();
  for (const f of schema ?? []) {
    const list = f.path.indexOf("[]");
    if (list >= 0) {
      const root = f.path.slice(0, list);
      out.set(root, { path: root, detail: "list" });
    } else {
      out.set(f.path, { path: f.path, detail: f.type });
    }
  }
  return [...out.values()];
}

/** The server's check of an expression while it is typed: its problems and the type it returns. */
export function useExpressionCheck(
  value: string,
  on: Trigger,
  expect: "condition" | "time",
  params: Record<string, ParamValue>,
  readOnly = false
) {
  const [problems, setProblems] = useState<CelProblem[]>([]);
  const [resultType, setResultType] = useState<string | null>(null);
  // Callers build params on every render; the check reruns only when they change.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (readOnly || !value.trim()) {
      setProblems([]);
      setResultType(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkExpression({
        on,
        expression: value,
        expect,
        params: JSON.parse(paramsKey),
      })
        .then((r) => {
          if (cancelled) return;
          setResultType(r.ok ? r.resultType : null);
          setProblems(
            r.findings.map((f) => ({
              position: f.position,
              message: f.message,
              severity: "error",
            }))
          );
        })
        .catch(() => {
          if (!cancelled) setProblems([]);
        });
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, on, expect, paramsKey, readOnly]);

  return { problems, resultType };
}

export function ProblemList({
  problems,
}: Readonly<{ problems: CelProblem[] }>) {
  return problems.map((p) => (
    <p
      key={`${p.position}-${p.message}`}
      className="text-xs text-red-600 dark:text-red-400"
    >
      {p.message}
    </p>
  ));
}

/** A CEL expression of a monitor, checked by the server while it is typed. */
export default function ExpressionField({
  label,
  value,
  onChange,
  on,
  expect,
  params,
  readOnly,
  placeholder,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  on: Trigger;
  expect: "condition" | "time";
  params: Record<string, ParamValue>;
  readOnly?: boolean;
  placeholder?: string;
}>) {
  const { data: schema } = useMonitorSchema(on, params);
  const { problems, resultType } = useExpressionCheck(
    value,
    on,
    expect,
    params,
    readOnly
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        {resultType && (
          <span className="font-mono text-[11px] text-gray-400">
            {resultType}
          </span>
        )}
      </div>
      <CelEditor
        value={value}
        onChange={(next) => {
          if (next !== value) onChange(next);
        }}
        fields={editorFields(schema)}
        problems={problems}
        singleLine
        readOnly={readOnly}
        placeholder={placeholder}
        ariaLabel={label}
      />
      <ProblemList problems={problems} />
    </div>
  );
}
