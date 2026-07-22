import { Suspense } from "react";
import { Perfil } from "@/features/gxc/components/perfil";

export default async function GxcPerfilPage({
  params,
}: {
  params: Promise<{ lang: string; tipo: string; id: string }>;
}) {
  const { lang } = await params;
  return (
    <Suspense>
      <Perfil lang={lang} />
    </Suspense>
  );
}
