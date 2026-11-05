import { useState } from "react";

const keysFor = (length: number) =>
  Array.from({ length }, () => crypto.randomUUID());

/** Keep input identity when an editable row is removed or its name changes. */
export function useRowKeys(length: number) {
  const [stored, setStored] = useState(() => keysFor(length));
  let keys = stored;
  // External draft replacements can change the row count independently of edits.
  if (stored.length !== length) {
    keys = keysFor(length);
    setStored(keys);
  }
  return {
    keys,
    append: () => setStored((current) => [...current, crypto.randomUUID()]),
    remove: (index: number) =>
      setStored((current) => current.filter((_, i) => i !== index)),
  };
}
