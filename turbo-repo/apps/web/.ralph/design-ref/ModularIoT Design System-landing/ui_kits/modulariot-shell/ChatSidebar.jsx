// ChatSidebar.jsx — Assistant dock, persists across screens
const { useState: useCh, useRef: useChR, useEffect: useChE } = React;

// ── Suggestion scripts: map prompt → agent response ─────────────────────
// Each yields a sequence of chat events: plan step, text chunk, or action.
const CHAT_SCRIPTS = {
  build_widget: {
    intent: "Build a new chart on the dashboard",
    trace: [
      { kind: "trace", label: "Understood intent → build widget", source: "LLM", delay: 260 },
      { kind: "trace", label: "telemetry.query({ metric: 'speed', dim: 'plate', last: '7d' })", source: "Fleet API", code: true, delay: 780 },
      { kind: "trace", label: "Shape result → bar chart, top 8 plates", source: "echarts", code: true, delay: 1200 },
    ],
    answer: "Here's a new widget — **Top 8 plates by avg. speed** from the last 7 days. Placed it at the end of your operations dashboard, highlighted so you can see what changed. Let me know if you want a different metric or timeframe.",
    action: {
      type: "build_widget",
      payload: {
        title: "Top 8 plates · avg. speed",
        meta: "Fleet API · last 7 days · km/h",
        option: {
          grid: { left: 70, right: 16, top: 10, bottom: 20 },
          xAxis: { type: "value", splitLine: { lineStyle: { color: "#F3F4F6" } }, axisLabel: { color: "#9CA3AF", fontSize: 10.5, formatter: "{value} km/h" } },
          yAxis: { type: "category", data: ["BRTX-42","KLMN-03","VRTY-11","HJKL-89","QPOR-77","XXRT-52","GGRD-21","LMNO-91"],
            axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#6B7280", fontSize: 10.5, fontFamily: "ui-monospace, monospace" } },
          tooltip: { trigger: "axis", formatter: "{b}: {c} km/h" },
          series: [{ type: "bar", data: [74,71,68,65,61,58,55,52], barWidth: 12,
            itemStyle: { color: "#D18900", borderRadius: [0,4,4,0] } }],
        },
      },
      confirm: "Open full widget editor",
    },
  },
  notify: {
    intent: "Notify drivers on delayed trips",
    trace: [
      { kind: "trace", label: "fleet.trips.delayed.list({ faena: 'SCL' })", source: "Fleet API", code: true, delay: 320 },
      { kind: "trace", label: "Found 2 delayed · resolve contact channels", source: "HR", code: true, delay: 720 },
      { kind: "trace", label: "Draft radio dispatch per driver", source: "LLM", delay: 1100 },
    ],
    answer: "Two drivers to notify: **Carlos Muñoz (T-4821)** — +42m, GPS static near KM 38, and **Ana Herrera (T-4814)** — +18m, recoverable. I drafted a short radio message for each. Review before I send — this is a **live action**.",
    action: {
      type: "confirm_action",
      payload: {
        headline: "Send dispatch to 2 drivers",
        rows: [
          { who: "Carlos Muñoz · BRTX-42", msg: "T-4821 flagged +42m. Confirm status at KM 38." },
          { who: "Ana Herrera · KLMN-03",  msg: "T-4814 running +18m. Verify route and ETA." },
        ],
        confirm: "Send both", cancel: "Review individually",
      },
    },
  },
  storytelling: {
    intent: "Start a storytelling canvas",
    trace: [
      { kind: "trace", label: "Map topic → relevant data sources", source: "LLM", delay: 340 },
      { kind: "trace", label: "compliance.q1.aggregate() · audits, incidents, renewals", source: "Compliance API", code: true, delay: 880 },
      { kind: "trace", label: "Draft narrative sections · live data bindings", source: "LLM", delay: 1280 },
    ],
    answer: "Draft ready: **'Q1 compliance in one page'** — six sections with live-data bindings. Every number refreshes on reload. Open it in the Storytelling workspace to edit inline or regenerate any section.",
    action: {
      type: "open_story",
      payload: { title: "Q1 compliance in one page", sections: 6 },
    },
  },
  approve: {
    intent: "Review pending signatures",
    trace: [
      { kind: "trace", label: "kanban.signatures.pending.list()", source: "Kanban DB", code: true, delay: 280 },
      { kind: "trace", label: "Cross-check incident flags · permissions", source: "LLM", delay: 620 },
    ],
    answer: "3 signatures waiting — all clean. Pedro Gálvez (T-4819) final POD · 12 min ago. Two from yesterday's shift. Approve in one step or review individually.",
    action: { type: "confirm_action", payload: {
      headline: "Approve 3 pending signatures",
      rows: [
        { who: "T-4819 · Pedro Gálvez",  msg: "Final POD · photo, QR, signature verified" },
        { who: "T-4803 · Marta Rivas",   msg: "Delivery confirmation · Alerce state: OK" },
        { who: "T-4798 · Luis Bravo",    msg: "Final POD · attached to ECM" },
      ],
      confirm: "Approve all", cancel: "Review one by one",
    }},
  },
};

function ChatMessage({ from, children, avatar }) {
  const isUser = from === "user";
  return (
    <div style={{ display: "flex", gap: 10, padding: "14px 16px", alignItems: "flex-start",
      background: isUser ? "transparent" : "#FAFBFC" }}>
      <span style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: isUser
          ? "#111928"
          : "linear-gradient(135deg, #D18900, #F1B300)",
        color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 600,
      }}>
        {isUser ? "JR" : MIco.sparkle}
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "#111928", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function TraceStep({ step, state }) {
  const done = state === "done", run = state === "running";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12,
      color: done || run ? "#111928" : "#9CA3AF", padding: "3px 0" }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
        background: done ? "#008A2E" : run ? "#fff" : "#F3F4F6",
        border: run ? "2px solid #D18900" : "1px solid #E5E7EB",
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff",
      }}>
        {done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        {run && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D18900", animation: "m-pulse 1.3s infinite" }}/>}
      </span>
      <span style={{
        fontFamily: step.code ? "ui-monospace, monospace" : "Inter",
        fontSize: step.code ? 11 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{step.label}</span>
      {step.source && (
        <span style={{ background: "#F3F4F6", color: "#6B7280", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>{step.source}</span>
      )}
    </div>
  );
}

function OpenStoryCard({ data, onOpen }) {
  return (
    <div style={{
      marginTop: 10, border: "1px solid #DBEAFE", background: "#EFF6FF",
      borderRadius: 10, padding: 12, fontSize: 12.5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontWeight: 600, color: "#1E3A8A" }}>
        <span>{MIco.story}</span>
        <span>Draft story ready</span>
      </div>
      <div style={{ fontSize: 12.5, color: "#1E40AF", marginBottom: 10, lineHeight: 1.45 }}>
        <strong style={{ color: "#1E3A8A" }}>{data.title}</strong> — {data.sections} sections, live-data bindings.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <MButton variant="primary" size="sm" icon={MIco.arrow} onClick={onOpen}>Open in Storytelling</MButton>
        <MButton variant="secondary" size="sm">Preview inline</MButton>
      </div>
    </div>
  );
}

function ConfirmActionCard({ data, onConfirm, onCancel }) {
  return (
    <div style={{
      marginTop: 10, border: "1px solid #FDE68A", background: "#FFFAEB",
      borderRadius: 10, padding: 12, fontSize: 12.5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 600, color: "#92400E" }}>
        <span>{MIco.bolt}</span>
        <span>{data.headline}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {data.rows.map((r, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #FEF3C7", borderRadius: 7, padding: "8px 10px" }}>
            <div style={{ fontSize: 11.5, color: "#92400E", fontWeight: 600 }}>{r.who}</div>
            <div style={{ fontSize: 12, color: "#451A03", marginTop: 2 }}>{r.msg}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <MButton variant="primary" size="sm" onClick={onConfirm}>{data.confirm || "Confirm"}</MButton>
        {data.cancel && <MButton variant="secondary" size="sm" onClick={onCancel}>{data.cancel}</MButton>}
      </div>
    </div>
  );
}

function ChatSidebar({ open, onClose, onBuildWidget, onOpenStory, width = 420, initialQuery = "" }) {
  const [msgs, setMsgs] = useCh([]);
  const [input, setInput] = useCh("");
  const [activeTrace, setActiveTrace] = useCh(null); // { steps, activeStep }
  const [streaming, setStreaming] = useCh(false);
  const scrollRef = useChR(null);
  const inputRef = useChR(null);

  useChE(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, activeTrace]);

  useChE(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 280);
    if (open && initialQuery && msgs.length === 0) {
      setTimeout(() => sendPrompt(initialQuery), 300);
    }
  }, [open]);

  function pickScript(q) {
    const s = q.toLowerCase();
    if (/story|tell|report|narrativ/.test(s)) return CHAT_SCRIPTS.storytelling;
    if (/notify|radio|dispatch|send|alert drivers?/.test(s)) return CHAT_SCRIPTS.notify;
    if (/approve|sign|firma|pending/.test(s)) return CHAT_SCRIPTS.approve;
    if (/chart|graph|widget|build|dashboard|metric|speed|plate|top/.test(s)) return CHAT_SCRIPTS.build_widget;
    return CHAT_SCRIPTS.build_widget;
  }

  function sendPrompt(q) {
    if (!q.trim() || streaming) return;
    const script = pickScript(q);
    setMsgs(m => [...m, { from: "user", text: q }]);
    setInput("");
    setStreaming(true);

    // Animate trace
    const steps = script.trace;
    setActiveTrace({ steps, active: 0 });
    steps.forEach((_, i) => {
      setTimeout(() => setActiveTrace(t => t ? { ...t, active: i + 1 } : t), steps[i].delay);
    });

    // After trace, stream the answer
    const endTrace = steps[steps.length - 1].delay + 200;
    setTimeout(() => {
      const answer = script.answer;
      setMsgs(m => [...m, { from: "agent", text: "", action: script.action }]);
      setActiveTrace(null);
      let i = 0;
      const tick = () => {
        i += 3;
        setMsgs(m => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: answer.slice(0, i) };
          return copy;
        });
        if (i < answer.length) setTimeout(tick, 14);
        else {
          setStreaming(false);
          // Auto-trigger silent actions (build_widget) after a beat
          if (script.action?.type === "build_widget") {
            setTimeout(() => onBuildWidget?.(script.action.payload), 400);
          }
        }
      };
      tick();
    }, endTrace);
  }

  function handleActionConfirm(msg) {
    const a = msg.action;
    if (a.type === "confirm_action") {
      setMsgs(m => m.map(x => x === msg ? { ...x, actionDone: "confirmed" } : x));
    } else if (a.type === "open_story") {
      onOpenStory?.(a.payload);
      setMsgs(m => m.map(x => x === msg ? { ...x, actionDone: "opened" } : x));
    }
  }
  function handleActionCancel(msg) {
    setMsgs(m => m.map(x => x === msg ? { ...x, actionDone: "skipped" } : x));
  }

  const empty = msgs.length === 0 && !activeTrace;

  return (
    <div style={{
      width: open ? width : 0, flexShrink: 0,
      borderLeft: open ? "1px solid #E5E7EB" : "none",
      background: "#fff", display: "flex", flexDirection: "column",
      transition: "width 260ms cubic-bezier(.2,.8,.2,1)",
      overflow: "hidden", height: "100vh",
    }}>
      <style>{`
        @keyframes m-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes m-caret { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>

      {/* Header */}
      <div style={{
        height: 56, borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center",
        gap: 10, padding: "0 14px", flexShrink: 0,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7,
          background: "linear-gradient(135deg, #D18900, #F1B300)",
          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{MIco.sparkle}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111928" }}>Assistant</div>
          <div style={{ fontSize: 10.5, color: "#6B7280", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0E9F6E" }}/>
            Connected · 7 data sources
          </div>
        </div>
        <button onClick={() => setMsgs([])} title="New conversation" style={{
          background: "transparent", border: "1px solid #E5E7EB", borderRadius: 7, color: "#6B7280",
          cursor: "pointer", padding: "4px 8px", fontSize: 11, fontFamily: "Inter",
        }}>New</button>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer",
          padding: 6, borderRadius: 6,
        }}>{MIco.x}</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {empty && (
          <div style={{ padding: "24px 18px" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#111928", marginBottom: 4, letterSpacing: "-0.01em" }}>
              What do you want to know?
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              I query your fleet, sensors, HR and compliance data. I can build dashboards, run actions, and compose stories.
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Try asking
            </div>
            {[
              { icon: MIco.bars, label: "Show me top 8 plates by avg. speed last week", hint: "Build widget" },
              { icon: MIco.bolt, label: "Notify drivers on all delayed trips from SCL", hint: "Live action" },
              { icon: MIco.story, label: "Tell me the story of Q1 compliance", hint: "Open storytelling" },
              { icon: MIco.check, label: "Approve pending signatures", hint: "Review queue" },
            ].map((s, i) => (
              <div key={i} onClick={() => sendPrompt(s.label)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 9,
                cursor: "pointer", marginBottom: 7, fontSize: 12.5, color: "#111928",
                transition: "background 120ms",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#F9FAFB"}>
                <span style={{ color: "#6B7280" }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 10, color: "#D18900", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.hint}</span>
              </div>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <ChatMessage key={i} from={m.from}>
            {m.from === "user" ? (
              <div style={{ fontWeight: 500 }}>{m.text}</div>
            ) : (
              <>
                {renderMarkdownish(m.text)}
                {streaming && i === msgs.length - 1 && (
                  <span style={{ display: "inline-block", width: 7, height: 13, background: "#111928", marginLeft: 2, verticalAlign: "-2px", animation: "m-caret 1s infinite" }}/>
                )}
                {m.action && !streaming && i === msgs.length - 1 && m.action.type === "confirm_action" && !m.actionDone && (
                  <ConfirmActionCard data={m.action.payload}
                    onConfirm={() => handleActionConfirm(m)}
                    onCancel={() => handleActionCancel(m)}/>
                )}
                {m.action && !streaming && i === msgs.length - 1 && m.action.type === "open_story" && !m.actionDone && (
                  <OpenStoryCard data={m.action.payload}
                    onOpen={() => handleActionConfirm(m)}/>
                )}
                {m.action && m.action.type === "build_widget" && !streaming && i === msgs.length - 1 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    <MButton variant="secondary" size="sm" icon={MIco.edit}>Edit widget</MButton>
                    <MButton variant="secondary" size="sm">Try a different metric</MButton>
                  </div>
                )}
                {m.actionDone === "confirmed" && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#046C4E", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span>{MIco.check}</span> Action executed
                  </div>
                )}
                {m.actionDone === "opened" && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#1A56DB", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span>{MIco.arrow}</span> Opened in Storytelling
                  </div>
                )}
              </>
            )}
          </ChatMessage>
        ))}

        {/* Active trace (sibling to the in-progress agent message) */}
        {activeTrace && (
          <div style={{ padding: "0 16px 14px 52px", background: "#FAFBFC" }}>
            <div style={{
              borderLeft: "2px solid #FDE68A", paddingLeft: 10, marginTop: 2,
            }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: "#92400E", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 6,
              }}>Agent plan</div>
              {activeTrace.steps.map((s, i) => (
                <TraceStep key={i} step={s}
                  state={i < activeTrace.active ? "done" : i === activeTrace.active ? "running" : "pending"}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid #F3F4F6", padding: 12, flexShrink: 0,
      }}>
        <div style={{
          border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff",
          transition: "border-color 160ms",
        }}>
          <textarea ref={inputRef}
            value={input}
            placeholder={streaming ? "Agent is working…" : "Ask, build, or act — anything you can think of"}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(input); }
            }}
            rows={2}
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              padding: "10px 12px 4px", fontSize: 13, fontFamily: "Inter", color: "#111928",
              background: "transparent", display: "block",
            }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 8px" }}>
            <button title="Attach" style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 6 }}>{MIco.attach}</button>
            <span style={{ fontSize: 10.5, color: "#9CA3AF", flex: 1 }}>Enter to send · Shift+Enter for newline</span>
            <button onClick={() => sendPrompt(input)} disabled={streaming || !input.trim()} style={{
              background: input.trim() && !streaming ? "#111928" : "#E5E7EB",
              color: input.trim() && !streaming ? "#fff" : "#9CA3AF",
              border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 11.5,
              fontWeight: 500, cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>{MIco.send} Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tiny markdown-ish: **bold**
function renderMarkdownish(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} style={{ color: "#111928", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

Object.assign(window, { ChatSidebar });
