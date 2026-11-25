"use client";

import { HiOutlineLocationMarker } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import TagPicker, {
  matchingExtras,
  TAG_CHIP_CLASS,
} from "@/features/common/components/tag-picker/tag-picker";
import type { TowerTripPlace } from "@/features/symptoms/control-tower/control-tower-api";
import { SECTION_INPUT_CLASS } from "./contact-person-section";
import type { ContactBadge } from "./taxonomy-store";

/** The most trip places listed under the input. */
const MAX_PLACES = 8;

/**
 * The trip places that match `query` and are not a tag yet, so a tag can be
 * written exactly as the trips name the place.
 */
export function placeSuggestions(
  places: readonly TowerTripPlace[],
  badges: readonly ContactBadge[],
  query: string
): TowerTripPlace[] {
  return matchingExtras(places, badges, query, MAX_PLACES);
}

/** "Origen de 3 viajes · destino de 1", leaving out a zero. */
export function placeDetail(place: TowerTripPlace, d: I18nRecord): string {
  const parts: string[] = [];
  if (place.origins > 0)
    parts.push(tr("badgesPlaceOrigin", d, { count: String(place.origins) }));
  if (place.destinations > 0)
    parts.push(
      tr("badgesPlaceDestination", d, { count: String(place.destinations) })
    );
  return parts.join(" · ");
}

/** A contact's tag chip; the contact table draws them the same way. */
export const BADGE_CLASS = TAG_CHIP_CLASS;

/**
 * Agrupación card — badges are shared descriptors ([transportista] [norte]
 * [santiago]), written with the shared tag picker. Type in the input:
 * existing badges that match show up to add (and rename or delete), then the
 * live trips' origins and destinations that are not a badge yet; when none
 * matches exactly, a "Crear" option makes a new one from the typed text. The
 * contact's descriptors are listed below.
 */
export default function ContactBadgesSection({
  selectedIds,
  onChange,
  badges,
  onCreate,
  onRename,
  onDelete,
  places = [],
  d,
}: Readonly<{
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  badges: readonly ContactBadge[];
  onCreate: (name: string) => ContactBadge;
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => void;
  /** The live trips' places, offered as new tags. */
  places?: readonly TowerTripPlace[];
  d: I18nRecord;
}>) {
  return (
    <TagPicker
      options={badges}
      selectedIds={selectedIds}
      onChange={onChange}
      onCreate={onCreate}
      onRename={onRename}
      onDelete={onDelete}
      extras={places.map((place) => ({
        label: place.label,
        detail: placeDetail(place, d),
      }))}
      extraIcon={HiOutlineLocationMarker}
      maxExtras={MAX_PLACES}
      inputClassName={SECTION_INPUT_CLASS}
      labels={{
        placeholder: tr("badgesInputPlaceholder", d),
        create: (name) => tr("badgesCreate", d, { name }),
        remove: (name) => `${tr("remove", d)} ${name}`,
        rename: tr("badgeRename", d),
        renameOf: (name) => `${tr("badgeRename", d)} ${name}`,
        deleteOf: (name) => `${tr("badgeDelete", d)} ${name}`,
        save: tr("save", d),
        cancel: tr("cancel", d),
        selectedTitle: tr("badgesSelectedTitle", d),
        empty: tr("badgesSelectedEmpty", d),
      }}
    />
  );
}
