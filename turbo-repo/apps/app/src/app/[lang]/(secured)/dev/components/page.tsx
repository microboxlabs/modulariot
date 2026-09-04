import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { ComponentsView } from "./components-view";

export default async function ComponentsPage(props: ParamsWithLang) {
  const { lang } = await props.params;

  if (process.env.ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  // ask_user_question's card reads harness-chat's i18n context — it's not
  // otherwise reachable here since this gallery renders extension cards
  // standalone, outside HarnessChat's own provider tree.
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <ComponentsView dict={dict} />
      </div>
    </div>
  );
}
