import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ObservationEntry } from "./observation.types";

/**
 * Display label for one observation code, falling back to the raw code.
 *
 * <p>The labels live under `bento.multimedia.obs_*` in the root dictionary, so a
 * consumer holding only a scoped subtree (the task confirm modal, for one) cannot
 * resolve them itself — codes must be turned into labels here, where the whole
 * dictionary is in hand, and travel already-resolved.
 */
export function observationTypeLabel(code: string, dictionary: I18nRecord): string {
  const key = `bento.multimedia.obs_${code}`;
  const label = tr(key, dictionary);
  return label === key ? code : label;
}

/** Every reason recorded across a set of observations, deduped and in first-seen order. */
export function observationReasonLabels(
  observations: readonly ObservationEntry[],
  dictionary: I18nRecord
): string[] {
  const codes = new Set(observations.flatMap((obs) => obs.types ?? []));
  return [...codes].map((code) => observationTypeLabel(code, dictionary));
}

export function relativeTime(date: Date, dictionary: I18nRecord): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tr("bento.multimedia.obs_just_now", dictionary);
  if (mins < 60) return `${mins}${tr("bento.multimedia.obs_time_m", dictionary)}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${tr("bento.multimedia.obs_time_h", dictionary)}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}${tr("bento.multimedia.obs_time_d", dictionary)}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}${tr("bento.multimedia.obs_time_mo", dictionary)}`;
  return `${Math.floor(months / 12)}${tr("bento.multimedia.obs_time_y", dictionary)}`;
}
