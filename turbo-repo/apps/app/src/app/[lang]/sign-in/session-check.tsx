"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SessionCheck({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session && !isRedirecting) {
      setIsRedirecting(true);
      router.push(`/${lang}/shipping`);
    }
  }, [session, status, lang, router, isRedirecting]);

  if (status === "loading") {
    return null;
  }

  return <>{children}</>;
}
