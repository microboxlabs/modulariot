"use client";

import { useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { Button } from "flowbite-react";
import { HiChevronUp, HiArrowRight } from "react-icons/hi";
import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { GiPoliceBadge } from "react-icons/gi";
import { MdCancel, MdBlock } from "react-icons/md";
import { SelectedOption } from "../../types/side-info";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { twMerge } from "tailwind-merge";

export interface OtherOption {
  id: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  option: SelectedOption;
  disabled?: boolean;
}

/** The "Otras opciones" list — shared with the call-center debug flow's own
 *  in-form switch dropdown (see `call-center/call-switch-dropdown.tsx`) so
 *  both places always offer the exact same set, disabled ones included. */
export function buildOtherOptions(dict: I18nRecord): OtherOption[] {
  const dictSy = dict.symptoms as I18nRecord;
  return [
    {
      id: 0,
      label: dictSy.derive_to_specialist as string,
      icon: HiArrowRight,
      option: "derive_to_specialist" as SelectedOption,
      disabled: true,
    },
    {
      id: 1,
      label: dictSy.contact_carabineros as string,
      icon: GiPoliceBadge,
      option: "contact_carabineros" as SelectedOption,
      disabled: true,
    },
    {
      id: 2,
      label: dictSy.contact_via_whatsapp as string,
      icon: FaWhatsapp,
      option: "contact_via_whatsapp" as SelectedOption,
      // Disabled until the Control Tower symptom→WhatsApp flow is finalized (single
      // symptom template + missing-data guard, no random picker). Matches the other
      // not-yet-ready options above; flip to re-enable.
      disabled: true,
    },
    {
      id: 3,
      label: dictSy.copilot as string,
      icon: BsStars,
      option: "copilot" as SelectedOption,
      disabled: true,
    },
    {
      id: 4,
      label: dictSy.ignore_condition as string,
      icon: MdCancel,
      option: "ignore_condition" as SelectedOption,
    },
    {
      id: 5,
      label: dictSy.invalidate_symptom as string,
      icon: MdBlock,
      option: "invalidate_symptom" as SelectedOption,
    },
  ];
}

/** Injected above the standard option list, its own group separated by a
 *  divider — e.g. the call-center flow's "Guardar y hacer otra llamada",
 *  which isn't one of the `SelectedOption` treatment types this dropdown
 *  otherwise switches to. */
export interface ExtraDropdownItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-1 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white dark:focus:bg-gray-600 dark:focus:text-white";

/**
 * Built directly on `@floating-ui/react`, with both the full-page blur and
 * the menu itself portaled to `document.body` (`FloatingPortal`) — not
 * Flowbite's `Dropdown`, whose floating content isn't portaled and so
 * renders wherever this button happens to sit in the DOM. That mattered
 * once this same component started getting used deep inside the call-center
 * debug flow's inline form: any ancestor along the way that clips overflow,
 * or sits mid-fade (`opacity` < 1, which — like `transform`/`filter` —
 * establishes a new "backdrop root") caps `backdrop-filter`'s reach to
 * *that ancestor's own content*, not the page behind it — so the blur
 * darkened the whole page (a plain translucent color, unaffected by that
 * restriction) while the actual glass-blur effect only ever showed within
 * the form's own card. Portaling both pieces straight to `<body>` escapes
 * any such ancestor entirely, regardless of what CSS it happens to use.
 */
export default function BlurrableDropdown({
  dict,
  onSelect,
  extraItems,
  forceDisableOptions,
  triggerClassName,
  disabled,
}: {
  dict: any;
  /** Called with the chosen treatment type — what happens next (open the
   *  panel, switch the panel's current form, …) is entirely up to the
   *  caller; this component no longer assumes either. */
  onSelect: (option: SelectedOption) => void;
  extraItems?: ExtraDropdownItem[];
  /** Greys out every standard option regardless of its own `disabled` flag
   *  — `extraItems` are unaffected. Used by the call-center flow: once the
   *  call result is "no contesta"/"buzón de voz", switching to a different
   *  treatment mid-call no longer makes sense, but "Guardar y hacer otra
   *  llamada" still should. */
  forceDisableOptions?: boolean;
  /** Merged onto the trigger's own classes (default `w-fit`, sized to its
   *  own label) — the call-center flow overrides it to `w-full` so it can
   *  cross-fade smoothly against a sibling that fills the same fixed-size
   *  slot, instead of an abrupt width jump. */
  triggerClassName?: string;
  /** Disables the trigger itself — the whole dropdown can't be opened. */
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const other_options = buildOtherOptions(dict);

  // Guards the case where `disabled` flips true while already open (e.g.
  // the note the operator was writing gets cleared) — forces it shut rather
  // than leaving an open menu behind a now-disabled trigger. Used both for
  // floating-ui's own `open` and for what actually renders below, so the
  // two can't disagree.
  const effectiveOpen = disabled ? false : isOpen;

  const { refs, floatingStyles, context } = useFloating({
    open: effectiveOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const selectOption = (option: SelectedOption) => {
    setIsOpen(false);
    onSelect(option);
  };

  return (
    <>
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        color="alternative"
        disabled={disabled}
        theme={{
          base: twMerge(
            "relative",
            "flex items-center justify-center",
            "!rounded-lg !rounded-r-none !border-l-1",
            "text-center font-medium",
            "focus:outline-none focus:ring-4",
            "cursor-pointer",
            "h-10 transition-all duration-100",
            "gap-2 w-fit",
            triggerClassName
          ),
        }}
      >
        <div className="flex items-center gap-2">
          <span className="lg:block hidden whitespace-nowrap">
            {tr("symptoms.other_options", dict)}
          </span>
          <HiChevronUp
            className={`w-5 h-5 transition-transform ease-in-out duration-300 ${effectiveOpen ? "rotate-180" : ""}`}
          />
        </div>
      </Button>
      {effectiveOpen && (
        <FloatingPortal>
          <div
            className="fixed inset-0 z-900 flex items-center justify-center bg-black/30 backdrop-blur-[10px]"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-901 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:divide-gray-600 dark:border-none dark:bg-gray-700"
          >
            {extraItems && extraItems.length > 0 && (
              <div className="py-1">
                {extraItems.map(({ id, label, icon: Icon, onClick }) => (
                  <button
                    key={id}
                    type="button"
                    className={itemClass}
                    onClick={() => {
                      setIsOpen(false);
                      onClick();
                    }}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="py-1">
              {other_options.map(({ id, label, icon: Icon, option, disabled: staticDisabled }) => {
                const disabled = staticDisabled || forceDisableOptions;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    className={`${itemClass} ${disabled ? "cursor-not-allowed! opacity-50" : ""}`}
                    onClick={() => {
                      if (disabled) return;
                      selectOption(option);
                    }}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
