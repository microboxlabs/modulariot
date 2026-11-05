"use client";

import { useState } from "react";
import { HiOutlineOfficeBuilding, HiOutlineTruck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SinglePick, { type PickOption } from "./single-pick";
import type { CompanyOption } from "./store";
import { normalizeLabel } from "./taxonomy-store";
import { displayId, guessCompanyIdType, type IdType } from "./tax-id";
import { useCarrierCompanies } from "./use-carrier-companies";

type CompanyPick = PickOption & { company: CompanyOption };

/**
 * Organization picker under an outside contact's RUT — the company the
 * contact belongs to (the API's `company`). The search bar lists the companies already used in the
 * book and the organization's own carriers, filtered while typing; picking one with a RUT fills the
 * company's RUT too. When no name matches exactly, a "Crear" option sets the typed one, without RUT.
 */
export default function ContactOrganizationSection({
  value,
  onChange,
  organizations,
  d,
}: Readonly<{
  value: string;
  /** `rut` is set when the picked company has one. */
  onChange: (next: string, rut?: string, taxIdType?: IdType) => void;
  organizations: readonly CompanyOption[];
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  const { companies: carriers, searching } = useCarrierCompanies(query);
  const carrierLabel = tr("companyCarrier", d);
  const options = mergeCompanies(organizations, carriers).map((company) =>
    companyPick(company, carrierLabel)
  );

  return (
    <SinglePick
      value={value}
      icon={HiOutlineOfficeBuilding}
      options={options}
      query={query}
      onQuery={setQuery}
      searching={searching}
      onPick={(o) =>
        onChange(o.company.name.trim(), o.company.rut, o.company.taxIdType)
      }
      onCreate={(name) => onChange(name)}
      onClear={() => onChange("")}
      texts={{
        label: tr("companyLabel", d),
        placeholder: tr("companyInputPlaceholder", d),
        remove: tr("companyRemove", d),
        create: (name) => tr("companyCreate", d, { name }),
        empty: tr("companyEmpty", d),
        searching: tr("companySearching", d),
      }}
    />
  );
}

/** A company as a pick: a carrier with a truck, its tax id at the right. */
function companyPick(
  company: CompanyOption,
  carrierLabel: string
): CompanyPick {
  const carrier = company.source === "carrier";
  return {
    company,
    label: company.name,
    hint: company.rut
      ? displayId(
          company.taxIdType ?? guessCompanyIdType(company.rut),
          company.rut
        )
      : undefined,
    icon: carrier ? HiOutlineTruck : HiOutlineOfficeBuilding,
    iconLabel: carrier ? carrierLabel : undefined,
  };
}

/** The book's companies, then the carriers the book doesn't have yet; a name appears once. */
function mergeCompanies(
  book: readonly CompanyOption[],
  carriers: readonly CompanyOption[]
): CompanyOption[] {
  const merged = new Map(book.map((o) => [normalizeLabel(o.name), o]));
  for (const carrier of carriers) {
    const key = normalizeLabel(carrier.name);
    const existing = merged.get(key);
    if (!existing) merged.set(key, carrier);
    else if (!existing.rut && carrier.rut)
      merged.set(key, { ...existing, rut: carrier.rut });
  }
  return [...merged.values()];
}
