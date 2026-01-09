import "server-only";

import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import PlanningLayout from "./planning-layout";

interface PlanningProps {
  dict: I18nDictionary;
}

export default function Planning({ dict }: Readonly<PlanningProps>) {
  return <PlanningLayout dict={dict} />;
}
