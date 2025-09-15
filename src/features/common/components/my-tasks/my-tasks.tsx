import ClientContainer from "./client-container";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function MyTasks({ dict }: { dict: I18nRecord }) {
  return <ClientContainer dict={dict} />;
}
