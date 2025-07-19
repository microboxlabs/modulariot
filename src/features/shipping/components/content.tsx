"use client";

import {
  Button,
  Label,
  Modal,
  Pagination,
  Textarea,
  TextInput,
} from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import type { FC } from "react";
import { useState, useEffect } from "react";
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
import { TaskCounter } from "@/features/shipping/components/TaskCounter";
import {
  useMyTasksCount,
  useMyTasks,
  useSearchTasks,
} from "@/features/common/providers/client-api.provider";
import { PiCaretUpDownBold } from "react-icons/pi";
import { ReactSortable } from "react-sortablejs";
import {
  KanbanBoard,
  KanbanBoardTask,
  KanbanPageData,
  Task,
} from "../types/common.types";
import KanbanCard from "./kanban-card/kanban-card";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { ViewSwitcher } from "@/features/common/components/view-switcher/view-switcher";
import { useViewPreference } from "../hooks/use-view-preference";
import { TableView } from "./views/table-view";
import { transformBoardsToTableData } from "../utils/transform-data";
import { configureLocale } from "@/features/common/services/days.service";
import { CompactKanbanViewSwitcher } from "@/features/common/components/view-switcher/compact-kanban-view-switcher";

export default function PageContent({
  showFinishedTasks,
  showWorkflowTasks,
  kanbanBoards,
  dict,
  lang,
}: PropsWithI18nDict<KanbanPageData>) {
  const { activeView, handleViewChange } = useViewPreference("kanban");
  const [list, setList] = useState<KanbanBoard[]>(kanbanBoards);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [compactKanbanView, setCompactKanbanView] = useState(false);
  const pageSize = 100;

  configureLocale(lang);
  const columns = showWorkflowTasks
    ? showWorkflowTasks === "shipping"
      ? [...SHIPPING_COORDINATOR_PROCESS_TASKS_V2]
      : showWorkflowTasks === "delivery"
        ? [...DELIVERY_COORDINATOR_PROCESS_TASKS]
        : []
    : [...SHIPPING_COORDINATOR_PROCESS_TASKS];

  const {
    data: myTasksData,
    error: myTasksError,
    isLoading: _1,
  } = useMyTasks(
    [...columns],
    showFinishedTasks,
    page,
    pageSize,
    searchParams.toString(),
  );

  const {
    data: searchTasksData,
    error: searchTasksError,
    isLoading: _2,
  } = useSearchTasks(showFinishedTasks ? null : searchParams.get("search"));

  const { data: _3, error: taskCountError } = useMyTasksCount();

  useEffect(() => {
    if (searchTasksData) {
      const newBoards = list.map((board) => ({
        ...board,
        tasks: searchTasksData.data[board.title]?.tasks ?? [],
      }));
      setList(newBoards);
    } else if (myTasksData) {
      const newBoards = list.map((board) => ({
        ...board,
        tasks: myTasksData.data[board.title]?.tasks ?? [],
      }));

      setList(newBoards);
    }
  }, [searchTasksData, myTasksData, page, searchParams.get("search")]);

  if (myTasksError?.status === 401 || searchTasksError?.status === 401) {
    router.replace(`/${lang}/sign-in`);
  }

  if (taskCountError || myTasksError || searchTasksError) {
    return (
      <div>
        Error:{" "}
        {taskCountError?.message ||
          myTasksError?.message ||
          searchTasksError?.message}
      </div>
    );
  }

  const countTasks = (tasks: Task[]): number => {
    return tasks.length;
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="inline-block align-middle relative">
        <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
          <ClientBreadcrumb
            path={[
              "breadcrumb.tasks",
              showFinishedTasks ? "breadcrumb.finished" : "breadcrumb.shipping",
            ]}
            lang={lang}
            rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
            dict={dict}
          />
          <div className="flex items-center gap-1">
            <CompactKanbanViewSwitcher
              kanbanView={activeView === "kanban"}
              activeView={compactKanbanView}
              onViewChange={setCompactKanbanView}
              dict={dict}
            />
            <ViewSwitcher
              activeView={activeView}
              onViewChange={handleViewChange}
              dict={dict}
            />
          </div>
        </div>
      </div>
      <div className="h-screen w-full overflow-auto">
        {activeView === "kanban" ? (
          <div
            className={`flex items-start justify-start ${compactKanbanView ? "mx-2 gap-2" : "mx-4 gap-4"} `}
          >
            {list.map((board) => {
              if (showFinishedTasks) {
                if (!board.finished) {
                  return null;
                }
              } else {
                if (board.finished) {
                  return null;
                }
              }
              return (
                <div key={board.id}>
                  <div
                    className={`mb-4 text-gray-900 dark:text-gray-300 text-center flex flex-col ${compactKanbanView ? "text-base font-semibold gap-2" : "h-[4.5rem] text-base font-semibold"}`}
                    style={{
                      width: compactKanbanView ? "12rem" : "16rem",
                    }}
                  >
                    <div className="flex-1">
                      {tr(
                        `kanban.${board.title}${compactKanbanView && ((dict as I18nRecord).kanban as I18nRecord)[board.title + "Compact"] ? "Compact" : ""}`,
                        dict,
                      )}
                    </div>
                    <TaskCounter count={countTasks(board.tasks)} dict={dict} />
                  </div>
                  <div className="mb-6 space-y-4">
                    <ReactSortable
                      animation={100}
                      forceFallback
                      group="kanban"
                      list={board.tasks}
                      setList={(tasks: KanbanBoardTask[]) =>
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
                        <KanbanCard
                          key={task.id}
                          task={task}
                          dict={dict}
                          table_name={board.title}
                          compactKanbanView={compactKanbanView}
                        />
                      ))}
                    </ReactSortable>
                  </div>
                  <AddAnotherCardModal />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto px-4 bg-white dark:bg-gray-900 dark:text-white flex flex-col h-full">
            <TableView
              set_page={setPage}
              page={page}
              pageSize={pageSize}
              data={transformBoardsToTableData(
                list.reduce(
                  (acc, board) => {
                    acc[board.title] = board;
                    return acc;
                  },
                  {} as Record<string, KanbanBoard>,
                ),
              )}
              dict={dict}
              lang={lang}
              data_length={myTasksData?.total}
            />
            <div className="w-full flex py-2 justify-center align-middle items-center mt-auto">
              <Pagination
                theme={{
                  pages: {
                    base: "xs:mt-0 mt-0 inline-flex items-center align-middle -space-x-px",
                  },
                }}
                nextLabel=""
                previousLabel=""
                currentPage={page}
                totalPages={Math.ceil((myTasksData?.total ?? 100) / pageSize)}
                onPageChange={(page) => {
                  setPage(page);
                }}
                showIcons
              />
            </div>
          </div>
        )}
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
              I&apos;m made some wireframes that we would like you to follow
              since we are building it in Google&apos;s Material Design (Please
              learn more about this and see how to improve standard material
              design into something beautiful). But besides that, you can just
              do it how you like.
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
                referring traffic sources (ex. Google or Facebook). So
                we&apos;re actually missing a column that should say
                &quot;Source&quot;. And there should be no icon for the
                merchants.
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
