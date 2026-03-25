import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ExtTaskExecutor from "@/features/ext-tasks/components/ext-task-executor";

export default async function ExtTaskPage({
  params,
}: ParamsWithLang<{ taskType: string; token: string }>) {
  const { lang, taskType, token } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <NavbarSignIn />
      <div className="flex w-full max-w-md flex-col items-center gap-4 px-5 pt-20">
        <ExtTaskExecutor token={token} taskType={taskType} dict={dict} />
      </div>
    </div>
  );
}
