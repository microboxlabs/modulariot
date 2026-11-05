"use client";

import { useState } from "react";
import { HiOutlineBriefcase } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SinglePick from "./single-pick";

/** The contact's role, picked from the roles already used in the book or created. */
export default function ContactRoleSection({
  value,
  onChange,
  roles,
  d,
}: Readonly<{
  value: string;
  onChange: (next: string) => void;
  roles: readonly string[];
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  return (
    <SinglePick
      value={value}
      icon={HiOutlineBriefcase}
      options={roles.map((label) => ({ label }))}
      query={query}
      onQuery={setQuery}
      onPick={(o) => onChange(o.label)}
      onCreate={onChange}
      onClear={() => onChange("")}
      texts={{
        label: tr("roleLabel", d),
        placeholder: tr("roleInputPlaceholder", d),
        remove: tr("roleRemove", d),
        create: (name) => tr("roleCreate", d, { name }),
        empty: tr("roleEmpty", d),
      }}
    />
  );
}
