"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { tr } from "@/features/i18n/tr.service";
import { Button, Textarea } from "flowbite-react";
import { IoMdSend } from "react-icons/io";
import Message from "./message";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import {
  useForumDiscussion,
  createForumMessage,
  createForumTopicClient,
} from "@/features/common/providers/client-api.provider";
import { useSession } from "next-auth/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FlatMessage = {
  sender: string;
  name: string;
  message: string;
  reason: string | null;
  date: string;
  topicRef: string;
};

function htmlToText(html: string): string {
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  } catch {
    return html;
  }
}

export default function Forum({
  dict,
  task,
}: {
  dict: I18nRecord;
  task: TaskResponse;
}) {
  const { data: session } = useSession();
  const currentUser = session?.user?.email || session?.user?.name || "";
  const queryParams = useMemo(() => {
    return {
      instanceId: task.instanceId ?? undefined,
      taskId: task.id ?? undefined,
      serviceCode: task.mintral_serviceCode ?? undefined,
    };
  }, [task]);

  const { discussion, isLoading, mutate } = useForumDiscussion(queryParams);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: FlatMessage[] = useMemo(() => {
    const list: FlatMessage[] = [];
    if (!discussion?.topics) return list;
    for (const topic of discussion.topics) {
      for (const post of topic.posts ?? []) {
        list.push({
          sender: post.author,
          name: post.author,
          message: htmlToText(post.content || post.title || ""),
          reason: null,
          date: post.created,
          topicRef: topic.ref,
        });
        for (const reply of post.replies ?? []) {
          list.push({
            sender: reply.author,
            name: reply.author,
            message: reply.title,
            reason: null,
            date: reply.created,
            topicRef: topic.ref,
          });
        }
      }
    }
    // sort by date asc
    return list.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [discussion]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;

    // Choose first available topic or create one
    let topicRef = discussion?.topics?.[0]?.ref;
    if (!topicRef) {
      // create topic using bpmPackage from task
      try {
        void (await createForumTopicClient({
          bpmPackage: task.bpm_package,
          title: "CHAT",
          content: "",
        }));
        await mutate();
        topicRef = (discussion?.topics ?? [])[0]?.ref;
      } catch {
        // ignore
      }
    }

    if (!topicRef) return;

    // Optimistic append
    setText("");
    setTimeout(scrollToBottom, 0);

    try {
      void (await createForumMessage({
        topic: topicRef,
        content,
        title: "Message",
      }));
      await mutate();
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      // could show toast
    }
  };

  return (
    <CustomCard
      title={tr("forum", dict.bento as I18nRecord)}
      subtitle={tr("forum_subtitle", dict.bento as I18nRecord)}
    >
      <div className="relative flex gap-2 flex-col flex-grow overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
        <div
          ref={scrollRef}
          className="flex flex-col gap-2 w-full flex-grow overflow-y-auto px-4 py-2"
        >
          {isLoading && (
            <div className="text-center text-sm text-gray-500">
              Cargando conversación…
            </div>
          )}
          {!isLoading &&
            (() => {
              let last_hour = "";
              let isFirstDateSeparator = true;

              return messages.map((comment, index) => {
                const returnable = (
                  <div
                    key={`${comment.topicRef}-${index}`}
                    className="last:mb-12"
                  >
                    {last_hour != to_date(comment.date) && (
                      <div
                        className={`flex justify-center items-center w-full mb-2 ${
                          isFirstDateSeparator ? "" : "mt-4"
                        }`}
                      >
                        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 text-xs text-gray-400 rounded-full">
                          {is_today(to_date(comment.date), dict)}
                        </div>
                      </div>
                    )}

                    <Message comment={comment} this_mail={currentUser} />
                  </div>
                );

                if (last_hour != to_date(comment.date)) {
                  last_hour = to_date(comment.date);
                  isFirstDateSeparator = false;
                }

                return returnable;
              });
            })()}
        </div>
        <form
          onSubmit={handleSubmit}
          className="w-full flex align-bottom flex-row gap-2 absolute bottom-2 left-0 right-0 px-4"
        >
          <Textarea
            id="autoGrowingTextarea"
            className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 max-h-20"
            placeholder="Escribe aquí un comentario..."
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              const textarea = e.currentTarget as HTMLTextAreaElement;
              textarea.style.height = "auto";
              textarea.style.height = textarea.scrollHeight + "px";
            }}
          />
          <Button
            color="blue"
            type="submit"
            className="h-10 w-10"
            disabled={!text.trim()}
          >
            <IoMdSend className="text-white h-5 w-5" />
          </Button>
        </form>
      </div>
    </CustomCard>
  );
}

function to_date(date: string): string {
  let new_date = new Date(date).toLocaleTimeString([], {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return new_date.split(",")[0];
}

function is_today(formattedDate: string, dict: I18nRecord): string {
  if (!formattedDate) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
      .format(d)
      .split(",")[0];

  const todayStr = fmt(today);
  const yesterdayStr = fmt(yesterday);

  if (formattedDate === todayStr) return tr("today", dict.bento as I18nRecord);
  if (formattedDate === yesterdayStr)
    return tr("yesterday", dict.bento as I18nRecord);
  return formattedDate;
}
