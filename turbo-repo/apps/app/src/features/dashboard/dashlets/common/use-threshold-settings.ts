import { useCallback, useState } from "react";
import type {
  ThresholdConfig,
  ThresholdRuleItem,
  ThresholdTarget,
} from "./threshold-types";
import { DEFAULT_RULE_COLOR } from "./color-rule-types";
import {
  normalizeThresholdConfig,
  toThresholdRuleItems,
  fromThresholdRuleItems,
} from "./threshold-helpers";

let nextId = 0;

export function useThresholdSettings(config: { thresholds?: ThresholdConfig }) {
  const normalized = normalizeThresholdConfig(config.thresholds);

  const [enabled, setEnabled] = useState(normalized.enabled);
  const [field, setField] = useState(normalized.field);
  const [applyTo, setApplyTo] = useState<ThresholdTarget[]>(normalized.applyTo);
  const [rules, setRules] = useState<ThresholdRuleItem[]>(
    toThresholdRuleItems(normalized.rules)
  );

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        _id: `tr-new-${nextId++}`,
        operator: "greater_than",
        value: "",
        color: DEFAULT_RULE_COLOR,
      },
    ]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const updateRule = useCallback(
    (id: string, ruleField: string, value: string) => {
      setRules((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [ruleField]: value } : r))
      );
    },
    []
  );

  const buildThresholdSavePayload = (): { thresholds: ThresholdConfig } => ({
    thresholds: {
      enabled,
      field,
      applyTo,
      rules: fromThresholdRuleItems(rules),
    },
  });

  return {
    thresholdEnabled: enabled,
    setThresholdEnabled: setEnabled,
    thresholdField: field,
    setThresholdField: setField,
    thresholdApplyTo: applyTo,
    setThresholdApplyTo: setApplyTo,
    thresholdRules: rules,
    addThresholdRule: addRule,
    removeThresholdRule: removeRule,
    updateThresholdRule: updateRule,
    buildThresholdSavePayload,
  };
}
