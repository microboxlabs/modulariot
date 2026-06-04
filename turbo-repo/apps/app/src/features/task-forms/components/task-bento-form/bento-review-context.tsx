"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type BentoReviewState = { pending: number; rejected: number };

type BentoReviewContextValue = {
  state: BentoReviewState;
  dispatch: (s: BentoReviewState) => void;
};

const BentoReviewContext = createContext<BentoReviewContextValue>({
  state: { pending: 0, rejected: 0 },
  dispatch: () => {},
});

export function BentoReviewProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<BentoReviewState>({ pending: 0, rejected: 0 });
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
