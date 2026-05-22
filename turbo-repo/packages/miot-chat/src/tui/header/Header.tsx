import { Box, Text } from "ink";
import { isAgenticTenantMismatch } from "../session/agentic.js";
import type { SessionMeta } from "../session/types.js";
import { Spinner } from "../transcript/Spinner.js";

export interface HeaderProps {
  meta: SessionMeta;
  streaming: boolean;
  pendingApprovals: number;
  turns?: number;
  approxTokens?: number;
  contextPercent?: number;
}

const SEPARATOR = " · ";

export function Header(props: HeaderProps): React.ReactElement {
  const { meta, streaming, pendingApprovals } = props;
  const shortConv = meta.conversationId.slice(0, 8);
  const agenticWarn = isAgenticTenantMismatch(meta.mode, meta.tenantId);
  const chips: React.ReactNode[] = [];

  chips.push(<Text key="tenant">tenant={meta.tenantId}</Text>);
  chips.push(<Text key="user">user={meta.userId}</Text>);
  chips.push(<Text key="conv">conv={shortConv}</Text>);
  chips.push(
    <Text key="mode" color={agenticWarn ? "yellow" : undefined}>
      {agenticWarn ? "⚠ " : ""}
      mode={meta.mode}
    </Text>,
  );
  chips.push(<Text key="url" dimColor>{meta.baseUrl}</Text>);
  if (meta.profileName) {
    chips.push(<Text key="profile" dimColor>profile={meta.profileName}</Text>);
  }
  if (pendingApprovals > 0) {
    chips.push(
      <Text key="appr" color="yellow">approvals={pendingApprovals}</Text>,
    );
  }
  if (typeof props.turns === "number") {
    chips.push(<Text key="turns" dimColor>turns={props.turns}</Text>);
  }
  if (typeof props.approxTokens === "number") {
    const pct =
      typeof props.contextPercent === "number" ? ` (${props.contextPercent}%)` : "";
    chips.push(
      <Text key="tok" dimColor>
        ctx≈{props.approxTokens}tok{pct}
      </Text>,
    );
  }
  if (streaming) {
    chips.push(<Spinner key="spinner" color="cyan" />);
  }

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="row" flexWrap="wrap">
      {interpose(chips, (i) => (
        <Text key={`sep-${i}`} dimColor>
          {SEPARATOR}
        </Text>
      ))}
    </Box>
  );
}

function interpose(
  nodes: React.ReactNode[],
  sep: (index: number) => React.ReactNode,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((node, i) => {
    if (i > 0) out.push(sep(i));
    out.push(node);
  });
  return out;
}
