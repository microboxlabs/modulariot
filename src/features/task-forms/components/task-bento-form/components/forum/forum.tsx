import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { tr } from "@/features/i18n/tr.service";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import Reason from "./reason";
import { Button, Textarea } from "flowbite-react";
import { IoMdSend } from "react-icons/io";

const comments = [
  {
    sender: "Pedro Echeverria",
    message: "He devuelto la task, pues el camion se presento con 500 litros de mostaza",
    reason: "No se puede cargar mostaza",
    date: "2025-07-25",
  },
  {
    sender: "Juan Perez",
    message: "¿Que hay de malo?",
    reason: null,
    date: "2025-07-25",
    is_self: true
  },
  {
    sender: "Pedro Echeverria",
    message: "La mostaza no es un producto de la mineria",
    reason: null,
    date: "2025-07-25",
  },
];

export default function Forum({ dict }: { dict: I18nRecord }) {
  return (
    <CustomCard
      title={tr("forum", (dict.bento as I18nRecord))}
      subtitle={tr("forum_subtitle", (dict.bento as I18nRecord))}
    >
      <div className="relative flex gap-2 flex-col flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
        {comments.map((comment, index) => (
          <div key={index} className={`flex flex-row gap-2 ${comment.is_self ? "flex-row-reverse ml-12" : "mr-12"}`}>
            <InitialIdentifier name={comment.sender} />
            <div className={`flex flex-col ${comment.is_self ? "rounded-lg rounded-tr-none" : "rounded-lg rounded-tl-none"} p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600`}>
              <div className="flex flex-row gap-2">
                <p className="text-md text-gray-700 dark:text-gray-300 font-light">
                  {comment.sender}
                </p>
                {comment.reason && <Reason reason={comment.reason} />}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-light">
                {comment.message}
              </p>
            </div>
          </div>
        ))}
        <form className="w-full flex align-bottom flex-row gap-2 absolute bottom-2 left-0 right-0 px-2">
          <Textarea id="autoGrowingTextarea"
            className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 max-h-20"
            placeholder="Escribe aquí un comentario..."
            rows={1}
            onInput={(e) => {
              const textarea = e.currentTarget;
              textarea.style.height = 'auto';
              textarea.style.height = textarea.scrollHeight + 'px';
            }}
          />
          <Button color="blue" type="submit" className="h-10 w-10">
          <IoMdSend className="text-white h-5 w-5" /></Button>
        </form>
      </div>
    </CustomCard>
  );
}