"use client";

// Foro del recurso AMS — MISMO patrón del foro del expediente de servicio
// (task-bento-form/forum): burbujas con separadores de fecha + textarea con
// envío. La conversación vive en el ECM como discusión de contenido anclada
// a la carpeta del recurso (la misma de sus documentos), vía /api/ams/forum
// + APIs de foro de contenido. Se reutiliza el componente Message del bento.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Button, Textarea } from "flowbite-react";
import { IoMdSend } from "react-icons/io";
import Message from "@/features/task-forms/components/task-bento-form/components/forum/message";
import {
  useGetContentDiscussion,
  createContentForumTopic,
  replyContentForumPost,
} from "@/features/common/providers/client-api.provider";
import { useSession } from "next-auth/react";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type FlatMessage = {
  sender: string; name: string; message: string;
  reason: string | null; date: string; topicRef: string;
};

const fmtDia = (date: string) =>
  new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" });

function etiquetaDia(dia: string): string {
  const hoy = new Date(); const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const f = (d: Date) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (dia === f(hoy)) return "Hoy";
  if (dia === f(ayer)) return "Ayer";
  return dia;
}

export function SeccionForo({ tipo, recId }: { tipo: "TRUCK" | "DRIVER"; recId: string }) {
  const { data: session } = useSession();
  const currentUser = session?.user?.email || session?.user?.name || "";
  const { data: nodo } = useSWR<{ nodeRef: string }>(
    `/app/api/ams/forum?resource_type=${tipo}&resource_id=${recId}`, fetcher);
  const { data: discussion, isLoading, mutate } = useGetContentDiscussion(nodo?.nodeRef);
  const [text, setText] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: FlatMessage[] = useMemo(() => {
    const list: FlatMessage[] = [];
    for (const topic of discussion?.topics ?? []) {
      for (const post of topic.posts ?? []) {
        list.push({ sender: post.author, name: post.author,
          message: post.content || post.title || "", reason: null,
          date: post.created, topicRef: topic.ref });
        for (const reply of post.replies ?? []) {
          list.push({ sender: reply.author, name: reply.author,
            message: reply.title, reason: null, date: reply.created, topicRef: topic.ref });
        }
      }
    }
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [discussion]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !nodo?.nodeRef || enviando) return;
    setEnviando(true); setText("");
    try {
      const topic = discussion?.topics?.[0];
      const primerPost = topic?.posts?.[0];
      if (topic && primerPost) {
        await replyContentForumPost(topic.ref, primerPost.ref, content);
      } else {
        await createContentForumTopic(nodo.nodeRef, "CHAT", content);
      }
      await mutate();
      setTimeout(scrollToBottom, 0);
    } catch {
      setText(content); // no perder lo escrito si falla
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-[260px] overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
      <div ref={scrollRef} className="flex flex-col gap-2 w-full flex-grow overflow-y-auto px-4 py-2">
        {(isLoading || !nodo) && (
          <div className="text-center text-sm text-gray-500 py-4">Cargando conversación…</div>
        )}
        {nodo && !isLoading && !messages.length && (
          <div className="text-center text-sm text-gray-500 py-4">
            Sin comentarios todavía — parte la conversación de este recurso.
          </div>
        )}
        {(() => {
          let ultimoDia = "";
          return messages.map((m, i) => {
            const dia = fmtDia(m.date);
            const separador = dia !== ultimoDia;
            ultimoDia = dia;
            return (
              <div key={`${m.topicRef}-${i}`} className="last:mb-14">
                {separador && (
                  <div className="flex justify-center items-center w-full mb-2 mt-2 first:mt-0">
                    <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 text-xs text-gray-400 rounded-full">
                      {etiquetaDia(dia)}
                    </div>
                  </div>
                )}
                <Message comment={m} this_mail={currentUser} />
              </div>
            );
          });
        })()}
      </div>
      <form onSubmit={enviar}
            className="w-full flex align-bottom flex-row gap-2 absolute bottom-2 left-0 right-0 px-4">
        <Textarea
          className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white max-h-20"
          placeholder="Escribe aquí un comentario…" rows={1} value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={(e) => {
            const t = e.currentTarget as HTMLTextAreaElement;
            t.style.height = "auto"; t.style.height = t.scrollHeight + "px";
          }} />
        <Button color="blue" type="submit" className="h-10 w-10"
                disabled={!text.trim() || !nodo || enviando}>
          <IoMdSend className="text-white h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
