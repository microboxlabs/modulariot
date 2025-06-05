"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SessionCheck({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push(`/${lang}/shipping`);
    }
  }, [session, lang, router]);

  return <>{children}</>;
}
