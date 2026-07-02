import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { randomUUID } from "node:crypto";
import type { SkillSummary } from "@microboxlabs/miot-harness-client";
import type { ResolvedConfig } from "../config.js";
import { packageVersion } from "../version.js";
import { Editor } from "./input/Editor.js";
import { TopLine } from "./chrome/TopLine.js";
import { TipLine } from "./chrome/TipLine.js";
import { FooterLine } from "./chrome/FooterLine.js";
import { InputFrame } from "./chrome/InputFrame.js";
import { WelcomeCard } from "./chrome/WelcomeCard.js";
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
import { isAgenticTenantMismatch } from "./session/agentic.js";
import { useSession, type HarnessClientLike } from "./useSession.js";
import { parseSlash } from "./slash/parse.js";
import {
  SlashRegistry,
  type ModalSpec,
  type SlashContext,
} from "./slash/registry.js";
import { Palette } from "./slash/Palette.js";
import { matchSkillRun } from "./slash/skillCommand.js";
import type { PaletteState } from "./input/Editor.js";
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
import { skillsCommand } from "./slash/handlers/skills.js";
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
      debug: props.config.debug,
    },
    ctx,
    client: props.client,
  });

  const { setTheme } = useTheme();
  const [extraItems, setExtraItems] = useState<TranscriptItem[]>([]);
  const [modal, setModalState] = useState<ModalState>({ spec: null });
  const [palette, setPalette] = useState<PaletteState>({
    active: false,
    query: "",
    index: 0,
  });
  const [skills, setSkills] = useState<SkillSummary[]>([]);

  // Pull the harness skills so each becomes a `/<id>` command in the
  // palette — discoverable and callable like Claude Code. Degrades
  // silently: if the client has no skills resource or the harness is
  // unreachable, the palette just shows the built-in commands.
  const tenantId = session.state.meta.tenantId;
  useEffect(() => {
    const list = props.client.skills?.list;
    if (!list) return;
    let cancelled = false;
    void list({ tenant: tenantId })
      .then((loaded) => {
        if (!cancelled) setSkills(loaded);
      })
      .catch(() => {
        /* harness down / no skills — palette omits them */
      });
    return (): void => {
      cancelled = true;
    };
  }, [props.client, tenantId]);

  // Built-in commands plus one `/<id>` entry per harness skill, so `/`
  // lists everything with descriptions. `skillIds` is the set of names
  // that route to a skill run (vs a built-in command handler).
  const { registry, skillIds } = useMemo(() => {
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
      .register(approveCommand)
      .register(skillsCommand);
    const builtinNames = new Set(reg.all().map((c) => c.name));
    const ids = new Set<string>();
    for (const skill of skills) {
      if (builtinNames.has(skill.id)) continue; // never shadow a built-in
      reg.register({
        name: skill.id,
        summary: skill.description || skill.when_to_use || skill.name,
        usage: `/${skill.id}`,
        // Execution happens in handleSubmit (a skill run, not a command
        // handler); this entry exists for palette display + tab-complete.
        handle: () => ({}),
      });
      ids.add(skill.id);
    }
    return { registry: reg, skillIds: ids };
  }, [skills]);

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

  // Global shortcuts advertised on the welcome card. Routed through
  // the slash handlers so behavior stays identical to the typed
  // commands. The Editor's keymap ignores these combos; ctrl+h is
  // off-limits (terminals emit it as backspace), hence ctrl+g for
  // help. Inactive while a modal is open so pickers own their keys.
  useInput((input, key) => {
    if (!key.ctrl || modal.spec !== null) return;
    if (input === "r") void dispatchSlash("/resume");
    else if (input === "t") void dispatchSlash("/theme");
    else if (input === "g") void dispatchSlash("/help");
    else if (input === "q") void dispatchSlash("/exit");
  });

  const handleSubmit = useCallback(
    (text: string): void => {
      // `/<skill-id> [args]` runs a turn with that skill activated — the
      // harness injects its SKILL.md body as guidance. Args become the
      // message; with no args we send a gentle kickoff and let the skill
      // drive (e.g. ask its own clarifying questions).
      const skillRun = matchSkillRun(text, skillIds);
      if (skillRun) {
        appendSystem(`↳ skill: ${skillRun.skillId}`);
        void session.submit(skillRun.message, { skillId: skillRun.skillId });
        return;
      }
      if (text.trim().startsWith("/")) {
        void dispatchSlash(text);
        return;
      }
      void session.submit(text);
    },
    [appendSystem, dispatchSlash, session, skillIds],
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
  const version = useMemo(() => packageVersion(), []);
  const showWelcome = allItems.length === 0 && modalSpec === null;
  const meta = session.state.meta;
  const agenticWarn = isAgenticTenantMismatch(meta.mode, meta.tenantId);

  return (
    <Box flexDirection="column">
      {props.themeWarning ? (
        <Box paddingX={1}>
          <SystemNote text={`theme: ${props.themeWarning}`} />
        </Box>
      ) : null}
      <TopLine meta={meta} streaming={isStreaming(session.state)} />
      {showWelcome ? (
        <WelcomeCard version={version} />
      ) : (
        <Transcript
          items={allItems}
          isStreaming={isStreaming(session.state)}
        />
      )}
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
      {modalSpec?.kind === "approval" &&
      isApprovalsUiEnabled() &&
      session.state.pendingApprovals.length > 0 ? (
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
      <TipLine tipIndex={turnCount(session.state)} />
      {editorActive && palette.active ? (
        <Box paddingX={1}>
          <Palette
            registry={registry}
            query={palette.query}
            selectedIndex={palette.index}
          />
        </Box>
      ) : null}
      <InputFrame label={`miot · ${meta.mode}`} labelWarn={agenticWarn}>
        <Editor
          onSubmit={handleSubmit}
          isFocused={editorActive}
          registry={registry}
          onPaletteState={setPalette}
        />
      </InputFrame>
      <FooterLine
        turns={turnCount(session.state)}
        approxTokens={approxTokenCount(session.state)}
        contextPercent={contextPercent(session.state)}
        usageTotals={session.state.usageTotals}
        baseUrl={meta.baseUrl}
        profileName={meta.profileName}
        pendingApprovals={pendingApprovalCount(session.state)}
      />
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
