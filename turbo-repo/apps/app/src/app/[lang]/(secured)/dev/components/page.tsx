import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { ComponentsView } from "./components-view";

export default async function ComponentsPage(props: ParamsWithLang) {
  const { lang } = await props.params;

  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  return (
    <div className="h-full w-full overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <ComponentsView />
      </div>
    </div>
  );
}
