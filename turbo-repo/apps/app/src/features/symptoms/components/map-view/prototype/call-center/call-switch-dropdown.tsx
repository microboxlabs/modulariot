"use client";

/**
 * PROTOTYPE — replaces the final call form's plain "Hacer otra llamada"
 * button with the SAME "Otras opciones" dropdown shown at the base of the
 * system (`blurrable-dropdown.tsx`) — literally the same component, not a
 * lookalike, so the two can never visually or behaviorally drift apart.
 * `extraItems` adds "Guardar y hacer otra llamada" above the standard list,
 * and `onSelect` is wired to switch the panel's current form instead of
 * opening it fresh (the panel is already open, mid-call).
 */

import { FaPhoneAlt } from "react-icons/fa";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import BlurrableDropdown, { buildOtherOptions } from "../../blurrable-dropdown";
import { Button } from "flowbite-react";

export default function CallSwitchDropdown({
  dict,
  onSaveAndCallAgain,
  onSwitchOption,
  disableSwitchOptions,
  disabled,
}: {
  dict: I18nRecord;
  onSaveAndCallAgain: () => void;
  onSwitchOption: (option: SelectedOption) => void;
  /** True once the call result is "no contesta"/"buzón de voz" — switching
   *  to a different treatment mid-call no longer makes sense at that point,
   *  so every option except "Guardar y hacer otra llamada" is greyed out. */
  disableSwitchOptions?: boolean;
  /** Disables the whole thing — both variants — e.g. while the call note is
   *  still empty. */
  disabled?: boolean;
}) {
  const otherOptions = buildOtherOptions(dict);

  // "Guardar y hacer otra llamada" is always enabled; everything else in
  // `otherOptions` may or may not be (most of them are still `disabled: true`
  // — see `buildOtherOptions` — and `disableSwitchOptions` greys out the
  // rest too once the call result is "no contesta"/"buzón de voz"). When
  // exactly one action is actually usable, a dropdown offering "a choice of
  // one" is pointless ceremony — the button just performs that action
  // directly instead of opening a menu.
  const enabledActions = [
    {
      id: "save_and_call_again",
      label: tr("symptoms.save_and_call_again", dict),
      icon: FaPhoneAlt,
      onClick: onSaveAndCallAgain,
    },
    ...(disableSwitchOptions
      ? []
      : otherOptions
          .filter((o) => !o.disabled)
          .map((o) => ({
            id: String(o.id),
            label: o.label,
            icon: o.icon,
            onClick: () => onSwitchOption(o.option),
          }))),
  ];

  const isSingleAction = enabledActions.length === 1;
  const onlyAction = enabledActions[0];

  // Both variants stay mounted, cross-fading via opacity, instead of one
  // replacing the other outright (an instant cut). This was tried once
  // before and reverted: wrapping each variant in its own `<div>` makes it
  // simultaneously the "first" AND "last" child *of that solo wrapper*, so
  // Flowbite's grouped-button CSS (`first:rounded-s-lg`, `last:rounded-e-lg`,
  // `first:border-l` — keyed off `:first-child`/`:last-child`, i.e. actual
  // DOM position, not just "is this button inside a `ButtonGroup`") applies
  // BOTH sides' rules at once. Every override below now carries `!important`
  // so it wins regardless — `.first:x:first-child`/`.last:x:last-child`
  // selectors have higher specificity than a plain `.x` override, so a
  // non-important override can lose to them.
  return (
    <div className="relative h-10 flex-1">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isSingleAction ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Button
          color="blue"
          disabled={disabled}
          // `rounded-r-none!`: cancels the stray `last:rounded-e-lg` this
          // button also matches as a solo wrapper child. `border-l-0!`:
          // cancels `first:border-l`, which has no color of its own —
          // Tailwind v4 defaults an uncolored border to `currentColor`
          // (this button's white text), rendering as a stray white line
          // down the left edge. `color="light"` (what this replaced) never
          // showed it only because its own theme already sets an explicit
          // gray border on every side.
          className="h-10 w-full rounded-r-none! whitespace-nowrap border-l-0!"
          onClick={onlyAction?.onClick}
        >
          {onlyAction && (
            <>
              <onlyAction.icon className="mr-2 h-4 w-4" />
              {onlyAction.label}
            </>
          )}
        </Button>
      </div>
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isSingleAction ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <BlurrableDropdown
          dict={dict}
          onSelect={onSwitchOption}
          forceDisableOptions={disableSwitchOptions}
          triggerClassName="w-full"
          disabled={disabled}
          extraItems={[
            {
              id: "save_and_call_again",
              label: tr("symptoms.save_and_call_again", dict),
              icon: FaPhoneAlt,
              onClick: onSaveAndCallAgain,
            },
          ]}
        />
      </div>
    </div>
  );
}
