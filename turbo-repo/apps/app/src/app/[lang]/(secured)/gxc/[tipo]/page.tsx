import { Suspense } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { PerfilTipo } from "@/features/gxc/components/perfil-tipo";

export default async function GxcTipoPage({
  params,
}: {
  params: Promise<{ lang: string; tipo: string }>;
}) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <Suspense>
      <PerfilTipo lang={lang} dict={dictionary} />
    </Suspense>
  );
}
