import { Box, Text } from "ink";
import { isAgenticTenantMismatch } from "../session/agentic.js";
import type { SessionMeta } from "../session/types.js";

export interface HeaderProps {
  meta: SessionMeta;
  streaming: boolean;
  pendingApprovals: number;
}

// One frame of a braille spinner. The Header is a stateless component; the
// animation is driven by the parent re-rendering, so picking a single glyph
// here is fine — `<Spinner />` (T07) provides the animated version for the
// transcript.
const SPINNER_GLYPH = "◐";

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
  if (streaming) {
    chips.push(<Text key="spinner" color="cyan">{SPINNER_GLYPH}</Text>);
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
