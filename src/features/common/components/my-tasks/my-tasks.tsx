import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function MyTasks({ dict }: { dict: I18nRecord }) {
  return (
    <div className="flex flex-col flex-grow bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-hidden">
      <TaskListTitle />
      <TaskList dict={dict} />
    </div>
  );
}
