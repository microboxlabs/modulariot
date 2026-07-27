"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ObservationEntry } from "./components/side-data/multimedia-manager.tsx/viewer/observations/observation.types";

export type { ObservationEntry };
// `contentType` is the item's `mintral:contentType`. It travels with the verdict so a
// consumer can tell *which kind* of document was rejected without re-reading the node —
// the confirm modal turns it into the rejection codes the backend expects.
//
// `reasons` are the observation codes already resolved to display labels. They travel
// resolved because the labels live under `bento.multimedia.*` in the root dictionary and
// the confirm modal only ever holds a scoped subtree, so it cannot look them up itself.
export type RejectedItem = {
  fileName: string;
  contentType?: string;
  observations: ObservationEntry[];
  reasons: string[];
};
export type ApprovedItem = { fileName: string; observations: ObservationEntry[]; reasons: string[] };
type BentoReviewState = { pending: number; rejected: number; rejectedItems: RejectedItem[]; approvedItems: ApprovedItem[] };

type BentoReviewContextValue = {
  state: BentoReviewState;
  dispatch: (s: BentoReviewState) => void;
};

const BentoReviewContext = createContext<BentoReviewContextValue>({
  state: { pending: 0, rejected: 0, rejectedItems: [], approvedItems: [] },
  dispatch: () => {},
});

export function BentoReviewProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<BentoReviewState>({ pending: 0, rejected: 0, rejectedItems: [], approvedItems: [] });
  const value = useMemo(() => ({ state, dispatch: setState }), [state]);
  return (
    <BentoReviewContext.Provider value={value}>
      {children}
    </BentoReviewContext.Provider>
  );
}

export function useBentoReview() {
  return useContext(BentoReviewContext);
}
