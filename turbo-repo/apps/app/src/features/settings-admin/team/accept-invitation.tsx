"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import { acceptInvitation, switchOrganization } from "./team-api";

type State =
  | { kind: "accepting" }
  | { kind: "accepted"; organization: string | null }
  | { kind: "failed"; message: string };

/** The text for a failed acceptance: wrong email, gone, or anything else. */
export function failureMessage(error: unknown, d: I18nRecord): string {
  if (error instanceof ApiError && error.status === 403) {
    return tr("acceptOtherEmail", d);
  }
  if (error instanceof ApiError && error.status === 404) {
    return tr("acceptNotFound", d);
  }
  return tr("acceptFailed", d);
}

interface AcceptInvitationProps {
  readonly token: string;
  readonly lang: string;
  readonly d: I18nRecord;
}

/**
 * Accepts the invitation in the link once the user is signed in, and makes
 * the organization joined the active one.
 */
export function AcceptInvitation({ token, lang, d }: AcceptInvitationProps) {
  const [state, setState] = useState<State>({ kind: "accepting" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    acceptInvitation(token)
      .then(async ({ organization }) => {
        if (organization) {
          await switchOrganization(organization).catch(() => undefined);
        }
        setState({ kind: "accepted", organization });
      })
      .catch((e: unknown) =>
        setState({ kind: "failed", message: failureMessage(e, d) })
      );
  }, [token, d]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        {tr("acceptTitle", d)}
      </h1>
      {state.kind === "accepting" && (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Spinner size="sm" />
          {tr("accepting", d)}
        </div>
      )}
      {state.kind === "accepted" && (
        <>
          <Alert color="gray">{tr("accepted", d)}</Alert>
          <Button color="blue" href={`/app/${lang}`}>
            {tr("openOrganization", d)}
          </Button>
        </>
      )}
      {state.kind === "failed" && <Alert color="gray">{state.message}</Alert>}
    </div>
  );
}
