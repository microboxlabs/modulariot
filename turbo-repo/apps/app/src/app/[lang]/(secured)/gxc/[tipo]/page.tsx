import { Suspense } from "react";
import { PerfilTipo } from "@/features/gxc/components/perfil-tipo";

export default async function GxcTipoPage({
  params,
}: {
  params: Promise<{ lang: string; tipo: string }>;
}) {
  const { lang } = await params;
  return (
    <Suspense>
      <PerfilTipo lang={lang} />
    </Suspense>
  );
}
