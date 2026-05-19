import { Box, Text } from "ink";
import { marked, type Token, type Tokens } from "marked";
import { stripAnsi } from "../../output.js";
import type { ThemeTokens } from "../theme/tokens.js";

export interface MarkdownProps {
  text: string;
  theme: ThemeTokens;
}

export function Markdown(props: MarkdownProps): React.ReactElement {
  const cleaned = stripAnsi(props.text);
  const tokens = marked.lexer(cleaned);
  return (
    <Box flexDirection="column">
      {tokens.map((t, i) => (
        <BlockToken key={i} token={t} theme={props.theme} />
      ))}
    </Box>
  );
}

function BlockToken(props: {
  token: Token;
  theme: ThemeTokens;
}): React.ReactElement | null {
  const { token, theme } = props;
  switch (token.type) {
    case "space":
      return null;

    case "heading": {
      const h = token as Tokens.Heading;
      return (
        <Text bold color={theme.accent}>
          {h.tokens ? <InlineList tokens={h.tokens} theme={theme} /> : h.text}
        </Text>
      );
    }

    case "paragraph": {
      const p = token as Tokens.Paragraph;
      return (
        <Text>
          {p.tokens ? <InlineList tokens={p.tokens} theme={theme} /> : p.text}
        </Text>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <Box paddingLeft={2}>
          <Text dimColor>
            {bq.tokens && bq.tokens.length > 0 ? (
              bq.tokens.map((t, i) => (
                <BlockToken key={i} token={t} theme={theme} />
              ))
            ) : (
              bq.text
            )}
          </Text>
        </Box>
      );
    }

    case "code": {
      const c = token as Tokens.Code;
      return (
        <Box borderStyle="round" paddingX={1} flexDirection="column">
          {c.text.split("\n").map((line, i) => (
            <Text key={i}>{line.length > 0 ? line : " "}</Text>
          ))}
        </Box>
      );
    }

    case "list": {
      const l = token as Tokens.List;
      return (
        <Box flexDirection="column">
          {l.items.map((item, i) => (
            <Text key={i}>
              {"  "}• <InlineList tokens={item.tokens} theme={theme} />
            </Text>
          ))}
        </Box>
      );
    }

    case "hr":
      return <Text dimColor>──────</Text>;

    default: {
      const t = token as { text?: string };
      return <Text>{t.text ?? ""}</Text>;
    }
  }
}

function InlineList(props: {
  tokens: Token[];
  theme: ThemeTokens;
}): React.ReactElement {
  return (
    <>
      {props.tokens.map((t, i) => (
        <InlineToken key={i} token={t} theme={props.theme} />
      ))}
    </>
  );
}

function InlineToken(props: {
  token: Token;
  theme: ThemeTokens;
}): React.ReactElement {
  const { token, theme } = props;
  switch (token.type) {
    case "strong": {
      const s = token as Tokens.Strong;
      return (
        <Text bold>
          {s.tokens ? <InlineList tokens={s.tokens} theme={theme} /> : s.text}
        </Text>
      );
    }

    case "em": {
      const e = token as Tokens.Em;
      return (
        <Text italic>
          {e.tokens ? <InlineList tokens={e.tokens} theme={theme} /> : e.text}
        </Text>
      );
    }

    case "codespan": {
      const c = token as Tokens.Codespan;
      return <Text dimColor>{c.text}</Text>;
    }

    case "link": {
      const l = token as Tokens.Link;
      const inner = l.tokens ? (
        <InlineList tokens={l.tokens} theme={theme} />
      ) : (
        l.text
      );
      return (
        <Text>
          {inner} <Text dimColor>({l.href})</Text>
        </Text>
      );
    }

    case "br":
      return <Text>{"\n"}</Text>;

    default: {
      const t = token as { text?: string };
      return <Text>{t.text ?? ""}</Text>;
    }
  }
}
