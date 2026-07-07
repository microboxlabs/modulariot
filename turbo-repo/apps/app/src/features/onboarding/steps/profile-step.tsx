"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProfileOptionCard from "./profile-option-card";
import {
  PROFILES,
  recommendedReadySymptoms,
} from "@/features/vital-signs/vital-signs-data";

export default function ProfileStep({
  selectedProfileId,
}: {
  selectedProfileId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectProfile = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("profile", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col items-start w-full max-w-3xl mx-auto gap-4">
      <div className="flex flex-col text-left">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-white">
          What do you operate?
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          We&apos;ll recommend a starting set of vital signs — tune anything
          later.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {PROFILES.map((profile) => {
          const count = recommendedReadySymptoms(profile.id).length;
          return (
            <ProfileOptionCard
              key={profile.id}
              option={{
                id: profile.id,
                title: profile.label,
                description: profile.desc,
                count: count > 0 ? `${count} vital signs ready for now` : undefined,
              }}
              isSelected={profile.id === selectedProfileId}
              onSelect={selectProfile}
            />
          );
        })}
      </div>
    </div>
  );
}
