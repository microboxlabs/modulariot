import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ViewType = "table" | "kanban";

export function useViewPreference(initialView: ViewType = "kanban") {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  useEffect(() => {
    const savedView = localStorage.getItem("preferredView") as ViewType;
    if (savedView) {
      setActiveView(savedView);
    }
  }, []);

  const handleViewChange = useCallback(
    (view: ViewType) => {
      setActiveView(view);
      localStorage.setItem("preferredView", view);

      // Update URL without navigation
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    activeView,
    handleViewChange,
  };
}
