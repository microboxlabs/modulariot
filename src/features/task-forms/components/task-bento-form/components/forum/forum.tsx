import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { tr } from "@/features/i18n/tr.service";
import { Button, Textarea } from "flowbite-react";
import { IoMdSend } from "react-icons/io";
import Message from "./message";

const comments = [
  {
    sender: "pedroecheverria@gmail.com",
    name: "Pedro Echeverria",
    message:
      "He devuelto la task, pues el camion se presento con 500 litros de mostaza",
    reason: "No se puede cargar mostaza",
    date: "2025-07-25",
  },
  {
    sender: "juanperez@gmail.com",
    name: "Juan Perez",
    message: "¿Que hay de malo?",
    reason: null,
    date: "2025-07-25",
  },
  {
    sender: "pedroecheverria@gmail.com",
    name: "Pedro Echeverria",
    message: "La mostaza no es un producto de la mineria",
    reason: null,
    date: "2025-07-25",
  },
  {
    sender: "juanperez@gmail.com",
    name: "Juan Perez",
    message: "Ehhhhhh... ¿Estas seguro?",
    reason: null,
    date: "2025-07-25",
  },
];

export default function Forum({ dict }: { dict: I18nRecord }) {
  const this_mail = "juanperez@gmail.com";

  return (
    <CustomCard
      title={tr("forum", dict.bento as I18nRecord)}
      subtitle={tr("forum_subtitle", dict.bento as I18nRecord)}
    >
      <div className="relative flex gap-2 flex-col flex-grow overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
        <div className="flex flex-col gap-2 w-full flex-grow overflow-y-auto p-4">
          {comments.map((comment, index) => (
            <div key={index} className="last:mb-12 first:mt-2">
              <Message comment={comment} this_mail={this_mail} />
            </div>
          ))}
        </div>
        <form className="w-full flex align-bottom flex-row gap-2 absolute bottom-2 left-0 right-0 px-4">
          <Textarea
            id="autoGrowingTextarea"
            className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 max-h-20"
            placeholder="Escribe aquí un comentario..."
            rows={1}
            onInput={(e: any) => {
              const textarea = e.currentTarget;
              textarea.style.height = "auto";
              textarea.style.height = textarea.scrollHeight + "px";
            }}
          />
          <Button color="blue" type="submit" className="h-10 w-10">
            <IoMdSend className="text-white h-5 w-5" />
          </Button>
        </form>
      </div>
    </CustomCard>
  );
}
