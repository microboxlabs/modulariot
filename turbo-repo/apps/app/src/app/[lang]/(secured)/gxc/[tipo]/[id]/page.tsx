import { Suspense } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Perfil } from "@/features/gxc/components/perfil";

export default async function GxcPerfilPage({
  params,
}: {
  params: Promise<{ lang: string; tipo: string; id: string }>;
}) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <Suspense>
      <Perfil lang={lang} dict={dictionary} />
    </Suspense>
  );
}
