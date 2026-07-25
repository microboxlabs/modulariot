import { Suspense } from "react";
import { CapacityDesk } from "@/features/capacity/capacity-desk";

export default async function CapacityPage() {
  return (
    <Suspense>
      <CapacityDesk />
    </Suspense>
  );
}
