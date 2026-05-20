import { Box } from "ink";
import { useCallback, useMemo, useState } from "react";
import { randomUUID } from "node:crypto";
import type { ResolvedConfig } from "../config.js";
import { Editor } from "./input/Editor.js";
import { Header } from "./header/Header.js";
import { Transcript } from "./transcript/Transcript.js";
import { ContextModal } from "./modals/ContextModal.js";
import { ResumePicker } from "./modals/ResumePicker.js";
import { ThemePicker } from "./modals/ThemePicker.js";
import { ApprovalModal } from "./modals/ApprovalModal.js";
import {
  RunsPicker,
  summarizeRuns,
  type RunSummary,
} from "./modals/RunsPicker.js";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { loadUserTheme } from "./theme/loadUserTheme.js";
import { BUILTIN_THEMES } from "./theme/themes.js";
import {
  approxTokenCount,
  contextPercent,
  isStreaming,
  pendingApprovalCount,
  turnCount,
} from "./session/selectors.js";
import { isApprovalsUiEnabled } from "./session/approvals.js";
import { useSession, type HarnessClientLike } from "./useSession.js";
import { parseSlash } from "./slash/parse.js";
import {
  SlashRegistry,
  type ModalSpec,
  type SlashContext,
} from "./slash/registry.js";
import { helpCommand } from "./slash/handlers/help.js";
import { clearCommand } from "./slash/handlers/clear.js";
import { resetCommand } from "./slash/handlers/reset.js";
import { exitCommand } from "./slash/handlers/exit.js";
import { modeCommand } from "./slash/handlers/mode.js";
import { tenantCommand } from "./slash/handlers/tenant.js";
import { userCommand } from "./slash/handlers/user.js";
import { saveCommand } from "./slash/handlers/save.js";
import { contextCommand } from "./slash/handlers/context.js";
import { whoamiCommand } from "./slash/handlers/whoami.js";
import { themeCommand } from "./slash/handlers/theme.js";
import { resumeCommand } from "./slash/handlers/resume.js";
import { exportCommand } from "./slash/handlers/export.js";
import { runsCommand } from "./slash/handlers/runs.js";
import { approveCommand } from "./slash/handlers/approve.js";
import { readSession, listSessions } from "./persistence/store.js";
import { defaultMiotChatHome } from "./persistence/paths.js";
import type { TranscriptItem } from "./session/types.js";
import { useTheme } from "./theme/ThemeProvider.js";

export interface AppProps {
  config: ResolvedConfig;
  client: HarnessClientLike;
  home?: string;
  onExit?: () => void;
  now?: () => string;
  uuid?: () => string;
}

interface ModalState {
  spec: ModalSpec | null;
}

export function App(props: AppProps): React.ReactElement {
  const themeResult = useMemo(
    () => loadUserTheme(props.config.theme),
    [props.config.theme],
  );
  return (
    <ThemeProvider initialTheme={themeResult.theme}>
      <AppInner {...props} themeWarning={themeResult.warning} />
    </ThemeProvider>
  );
}

function AppInner(
  props: AppProps & { themeWarning: string | null },
): React.ReactElement {
  const home = props.home ?? defaultMiotChatHome();
  const now = props.now ?? ((): string => new Date().toISOString());
  const uuid = props.uuid ?? ((): string => randomUUID());
  const ctx = useMemo(() => ({ now, uuid }), [now, uuid]);

  const session = useSession({
    initial: {
      tenantId: props.config.tenantId,
      userId: props.config.userId,
      mode: props.config.mode,
      baseUrl: props.config.baseUrl,
      profileName: props.config.profileName,
    },
    ctx,
    client: props.client,
  });

  const { setTheme } = useTheme();
  const [extraItems, setExtraItems] = useState<TranscriptItem[]>([]);
  const [modal, setModalState] = useState<ModalState>({ spec: null });

  const registry = useMemo(() => {
    const reg = new SlashRegistry();
    reg
      .register(helpCommand)
      .register(clearCommand)
      .register(resetCommand)
      .register(exitCommand)
      .register(modeCommand)
      .register(tenantCommand)
      .register(userCommand)
      .register(saveCommand)
      .register(contextCommand)
      .register(whoamiCommand)
      .register(themeCommand)
      .register(resumeCommand)
      .register(exportCommand)
      .register(runsCommand)
      .register(approveCommand);
    return reg;
  }, []);

  const appendSystem = useCallback(
    (text: string): void => {
      setExtraItems((prev) => [
        ...prev,
        { kind: "system", id: uuid(), text, ts: now() },
      ]);
    },
    [now, uuid],
  );

  const dispatchSlash = useCallback(
    async (line: string): Promise<void> => {
      const parsed = parseSlash(line);
      if (!parsed) return;
      const cmd = registry.get(parsed.name);
      if (!cmd) {
        appendSystem(`unknown command: /${parsed.name}`);
        return;
      }
      const slashCtx: SlashContext = {
        registry,
        session: session.state,
        now,
        uuid,
        home,
        client: props.client,
      };
      // Wrap the dispatch so a throwing handler (e.g. /save hitting
      // an EPERM, /export writing to a read-only path) surfaces in
      // the transcript instead of becoming an unhandled rejection
      // when the caller does `void dispatchSlash(text)`. Catches both
      // synchronous throws and Promise rejections via the await.
      try {
        const result = await cmd.handle(parsed.args, slashCtx);
        if (result.error) appendSystem(result.error);
        if (result.dispatch) session.dispatch(result.dispatch);
        if (result.output) {
          setExtraItems((prev) => [...prev, result.output as TranscriptItem]);
        }
        if (result.modal) setModalState({ spec: result.modal });
        if (result.abort && props.onExit) props.onExit();
      } catch (err) {
        appendSystem(
          `error in /${parsed.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    },
    [
      registry,
      session,
      now,
      uuid,
      home,
      props.client,
      props.onExit,
      appendSystem,
    ],
  );

  const handleSubmit = useCallback(
    (text: string): void => {
      if (text.trim().startsWith("/")) {
        void dispatchSlash(text);
        return;
      }
      void session.submit(text);
    },
    [dispatchSlash, session],
  );

  const closeModal = useCallback(
    () => setModalState({ spec: null }),
    [],
  );

  const allItems = useMemo(
    () => [...session.state.transcript, ...extraItems],
    [session.state.transcript, extraItems],
  );

  const modalSpec = modal.spec;
  const editorActive = modalSpec === null;

  return (
    <Box flexDirection="column">
      {props.themeWarning ? (
        <Box paddingX={1}>
          <SystemNote text={`theme: ${props.themeWarning}`} />
        </Box>
      ) : null}
      <Transcript
        items={allItems}
        isStreaming={isStreaming(session.state)}
      />
      {modalSpec?.kind === "context" ? (
        <ContextModal
          session={session.state}
          lastRunId={session.state.currentRunId}
          onClose={closeModal}
        />
      ) : null}
      {modalSpec?.kind === "resume" ? (
        <ResumePicker
          summaries={listSessions(home)}
          onSelect={(id): void => {
            const loaded = readSession(home, id);
            if (loaded) session.dispatch({ kind: "LOAD_SESSION", state: loaded });
            else appendSystem(`could not read session ${id}`);
            closeModal();
          }}
          onCancel={closeModal}
        />
      ) : null}
      {modalSpec?.kind === "theme" ? (
        <ThemePicker
          initialName={
            typeof modalSpec.payload?.name === "string"
              ? modalSpec.payload.name
              : undefined
          }
          onSelect={(name): void => {
            const next = BUILTIN_THEMES[name];
            if (next) {
              setTheme(next);
              appendSystem(`theme: ${name}`);
            }
            closeModal();
          }}
          onCancel={closeModal}
        />
      ) : null}
      {modalSpec?.kind === "approval" && isApprovalsUiEnabled() ? (
        <ApprovalModal
          approval={session.state.pendingApprovals[0]!}
          onResolve={(decision, id): void => {
            session.dispatch({ kind: "RESOLVE_APPROVAL", id, decision });
            closeModal();
          }}
        />
      ) : null}
      {modalSpec?.kind === "runs" ? (
        <RunsPickerWrapped
          state={session.state}
          onSelect={(runId): void => {
            appendSystem(`replay run ${runId} — not yet implemented`);
            closeModal();
          }}
          onCancel={closeModal}
        />
      ) : null}
      <Header
        meta={session.state.meta}
        streaming={isStreaming(session.state)}
        pendingApprovals={pendingApprovalCount(session.state)}
        turns={turnCount(session.state)}
        approxTokens={approxTokenCount(session.state)}
        contextPercent={contextPercent(session.state)}
      />
      <Editor onSubmit={handleSubmit} isFocused={editorActive} />
    </Box>
  );
}

function RunsPickerWrapped(props: {
  state: ReturnType<typeof useSession>["state"];
  onSelect: (runId: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const runs: RunSummary[] = summarizeRuns(props.state);
  return (
    <RunsPicker runs={runs} onSelect={props.onSelect} onCancel={props.onCancel} />
  );
}

function SystemNote(props: { text: string }): React.ReactElement {
  return (
    <Box>
      <Text dimColor>{props.text}</Text>
    </Box>
  );
}

import { Text } from "ink";
