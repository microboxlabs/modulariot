import "server-only";

import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskFormProps } from "../task-form/task-form.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { HiClipboardList } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Bento from "../task-bento-form/bento";
// import { getInfoEntity } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.provider";
// import { getServiceValidation } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
// import { auth } from "@/auth";

export default async function MissionControlTripInitForm({
  task,
  lang,
  msg,
  /* userGroups, */
}: TaskFormProps) {
  // const session = await auth();
  const [dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  // const entityInfo = await getInfoEntity(
  //   task.mintral_truckLicensePlate as string,
  // );
  // const serviceValidation = await getServiceValidation(
  //   session?.user.ticket as string,
  //   task.mintral_serviceCode as string,
  // );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-5">
        <Breadcrumb
          path={["tasks", "shipping", "details"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={{
            ...(((dictionary.layout as I18nRecord).secured as I18nRecord)
              .sidebar as I18nRecord),
            details: dict("layout.secured.sidebar.details", {
              serviceCode: task.mintral_serviceCode as string,
            }),
          }}
        />
      </div>
      <Bento
        lang={lang}
        task={task as any}
        /* userGroups={userGroups} */
        dict={dictionary as I18nRecord}
        msg={(msg!.pages as I18nRecord).transportValidationForm as I18nRecord}
        enableActions={true}
      />
    </div>
  );
}
