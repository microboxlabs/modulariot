"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type BentoReviewState = { pending: number; rejected: number };

type BentoReviewContextValue = {
  state: BentoReviewState;
  dispatch: (s: BentoReviewState) => void;
};

const BentoReviewContext = createContext<BentoReviewContextValue>({
  state: { pending: 0, rejected: 0 },
  dispatch: () => {},
});

export function BentoReviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useState<BentoReviewState>({ pending: 0, rejected: 0 });
  return (
    <BentoReviewContext.Provider value={{ state, dispatch }}>
      {children}
    </BentoReviewContext.Provider>
  );
}

export function useBentoReview() {
  return useContext(BentoReviewContext);
}
