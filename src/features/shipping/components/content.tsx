"use client";

import { Button, Label, Modal, Textarea, TextInput } from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import type { FC } from "react";
import { Fragment, useState } from "react";
import {
  HiArchive,
  HiClipboardCopy,
  HiClipboardList,
  HiDocumentText,
  HiDotsHorizontal,
  HiEye,
  HiPaperClip,
  HiPencilAlt,
  HiPlus,
  HiPlusSm,
} from "react-icons/hi";
import { PiCaretUpDownBold } from "react-icons/pi";
import { ReactSortable } from "react-sortablejs";
import { KanbanBoard, KanbanPageData } from "../types/common.types";
import KanbanCard from "./kanban-card/kanban-card";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export default function KanbanPageContent({
  kanbanBoards,
  dict,
  tasks,
}: PropsWithI18nDict<KanbanPageData>) {
  const [list, setList] = useState<KanbanBoard[]>(kanbanBoards);
  console.log("tasks", tasks);
  return (
    <div className="inline-block min-w-full align-middle h-full">
      {/* <pre>{JSON.stringify(tasks, null, 2)}</pre> */}
      <div className="mb-6 flex items-start justify-start space-x-4 px-4">
        {list.map((board) => (
          <div key={board.id}>
            <div className="my-4 text-base font-semibold text-gray-900 dark:text-gray-300 h-12 w-64">
              {tr(`kanban.${board.title}`, dict)}
            </div>
            <div className="mb-6 space-y-4">
              <ReactSortable
                animation={100}
                forceFallback
                group="kanban"
                list={board.tasks}
                setList={(tasks) =>
                  setList((list) => {
                    const newList = [...list];
                    const index = newList.findIndex(
                      (item) => item.id === board.id,
                    );
                    newList[index].tasks = tasks;
                    return newList;
                  })
                }
                disabled={true}
              >
                {board.tasks.map((task) => (
                  <KanbanCard key={task.id} task={task} dict={dict} />
                ))}
              </ReactSortable>
            </div>
            <AddAnotherCardModal />
          </div>
        ))}
      </div>
    </div>
  );
}

export const EditCardModal: FC = function () {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
      >
        <span className="sr-only">Edit card</span>
        <HiPencilAlt className="h-5 w-5" />
      </button>
      <Modal onClose={() => setOpen(false)} show={isOpen}>
        <Modal.Header>Edit task</Modal.Header>
        <Modal.Body>
          <div className="mb-3 text-2xl font-semibold leading-none text-gray-900 dark:text-white">
            Redesign Themesberg Homepage
          </div>
          <div className="mb-5 flex flex-col items-start justify-center space-y-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Added by&nbsp;
              <Link
                href="#"
                className="cursor-pointer text-primary-700 no-underline hover:underline dark:text-primary-500"
              >
                Bonnie Green
              </Link>
              , 22 hours ago
            </div>
            <div className="flex flex-row flex-wrap">
              <div className="flex items-center justify-start">
                <Link
                  href="#"
                  data-tooltip-target="bonnie-tooltip"
                  className="-mr-3"
                >
                  <Image
                    alt="Bonnie Green"
                    height={28}
                    src="/images/users/bonnie-green.png"
                    width={28}
                    className="rounded-full border-2 border-white dark:border-gray-800"
                  />
                </Link>
                <div
                  id="bonnie-tooltip"
                  role="tooltip"
                  className="invisible absolute z-10 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity duration-300"
                >
                  Bonnie Green
                </div>
                <Link
                  href="#"
                  data-tooltip-target="roberta-tooltip"
                  className="-mr-3"
                >
                  <Image
                    alt="Roberta Casas"
                    height={28}
                    src="/images/users/roberta-casas.png"
                    width={28}
                    className="h-7 w-7 rounded-full border-2 border-white dark:border-gray-800"
                  />
                </Link>
                <div
                  id="roberta-tooltip"
                  role="tooltip"
                  className="invisible absolute z-10 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity duration-300"
                >
                  Roberta Casas
                </div>
                <Link
                  href="#"
                  data-tooltip-target="michael-tooltip"
                  className="-mr-3"
                >
                  <Image
                    alt="Michael Gough"
                    height={28}
                    src="/images/users/michael-gough.png"
                    width={28}
                    className="rounded-full border-2 border-white dark:border-gray-800"
                  />
                </Link>
                <div
                  id="michael-tooltip"
                  role="tooltip"
                  className="invisible absolute z-10 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity duration-300"
                >
                  Michael Gough
                </div>
              </div>
              <Button
                color="gray"
                className="ml-5 font-bold dark:bg-gray-600 [&>*]:px-2.5 [&>*]:py-1"
              >
                <div className="flex items-center gap-x-2 text-xs">
                  <HiPlusSm className="h-4 w-4" />
                  Join
                </div>
              </Button>
              <Button
                color="gray"
                className="ml-3 font-bold dark:bg-gray-600 [&>*]:px-2.5 [&>*]:py-1"
              >
                <div className="flex items-center gap-x-2 text-xs">
                  <HiPaperClip className="h-4 w-4" />
                  Attachment
                </div>
              </Button>
            </div>
          </div>
          <div className="mb-2 inline-flex items-center text-center text-lg font-semibold text-gray-900 dark:text-white">
            <HiDocumentText className="mr-1 h-5 w-5" />
            Description
          </div>
          <div className="mb-4 space-y-2 text-base text-gray-500 dark:text-gray-400">
            <p>
              I made some wireframes that we would like you to follow since we
              are building it in Google’s Material Design (Please learn more
              about this and see how to improve standard material design into
              something beautiful). But besides that, you can just do it how you
              like.
            </p>
            <p>
              Next Friday should be done. Next Monday we should deliver the
              first iteration. Make sure, we have a good result to be delivered
              by the day.
            </p>
            <div className="w-max cursor-pointer text-sm font-semibold text-primary-700 hover:underline dark:text-primary-500">
              Show Full Description
            </div>
          </div>
          <div className="mb-4 w-full rounded-lg border border-gray-100 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
            <div className="p-4">
              <Label htmlFor="compose-mail" className="sr-only">
                Your comment
              </Label>
              <Textarea
                id="compose-mail"
                placeholder="Write a comment..."
                rows={4}
                className="border-none px-0 text-base focus:ring-0"
              />
            </div>
            <div className="flex items-center justify-between border-t p-4 dark:border-gray-600">
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-primary-700 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-primary-800"
              >
                <HiPaperClip className="mr-1 h-4 w-4" />
                Post comment
              </button>
              <div className="flex space-x-1 pl-0 sm:pl-2">
                <Link
                  href="#"
                  className="inline-flex cursor-pointer justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  <HiPaperClip className="h-6 w-6" />
                </Link>
                <Link
                  href="#"
                  className="inline-flex cursor-pointer justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-3">
              <Link href="#" className="shrink-0">
                <Image
                  alt="Micheal Gough"
                  height={28}
                  src="/images/users/michael-gough.png"
                  width={28}
                  className="rounded-full"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  Micheal Gough
                </p>
                <p className="truncate text-sm font-normal text-gray-500 dark:text-gray-400">
                  Product Manager
                </p>
              </div>
              <Link
                href="#"
                className="rounded-lg p-1 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
              >
                <HiDotsHorizontal className="h-4 w-4" />
              </Link>
            </div>
            <ul className="list-outside list-disc pl-6 text-xs text-gray-500 dark:text-gray-400">
              <li>
                Latest clicks/conversions. Where you currently have the logo for
                merchant, we should instead have a logo that represent the
                referring traffic sources (ex. Google or Facebook). So we’re
                actually missing a column that should say “Source”. And there
                should be no icon for the merchants.
              </li>
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="grid w-full grid-cols-2 items-center gap-3 sm:grid-cols-5">
            <Button color="blue" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <HiClipboardList className="h-5 w-5" />
                Save
              </div>
            </Button>
            <Button color="gray" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <PiCaretUpDownBold className="h-5 w-5" />
                Move
              </div>
            </Button>
            <Button color="gray" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <HiClipboardCopy className="h-5 w-5" />
                Copy
              </div>
            </Button>
            <Button color="gray" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <HiArchive className="h-5 w-5" />
                Archive
              </div>
            </Button>
            <Button color="gray" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <HiEye className="h-5 w-5" />
                Watch
              </div>
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

const AddAnotherCardModal: FC = function () {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Modal onClose={() => setOpen(false)} show={isOpen}>
        <Modal.Header>Add new task</Modal.Header>
        <Modal.Body>
          <form>
            <div className="mb-6 grid grid-cols-1 gap-y-2">
              <Label htmlFor="taskName">Task name</Label>
              <TextInput
                id="taskName"
                name="taskName"
                placeholder="Redesign homepage"
              />
            </div>
            <div className="mb-4 grid grid-cols-1 gap-y-2">
              <Label htmlFor="description">Enter a description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="On line 672 you ..."
                rows={6}
              />
            </div>
            <div className="flex w-full items-center justify-center">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white">
                <div className="flex items-center justify-center space-x-2">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-base">Drop files to upload</p>
                </div>
                <input type="file" className="hidden" />
              </label>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex items-center gap-x-3">
            <Button color="blue" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-x-2">
                <HiPlus className="text-lg" />
                Add card
              </div>
            </Button>
            <Button color="gray" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};
