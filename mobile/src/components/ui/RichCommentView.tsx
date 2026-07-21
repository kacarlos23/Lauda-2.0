import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { decodeRichTextEntities } from "../../../../src/contracts/richText";
import { colors } from "../../theme";

type Props = {
  value?: string | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
};

type Run = { text: string; style: TextStyle };

function parseRichText(value: string): Run[] {
  const tokens = value.split(/(<[^>]+>)/g).filter(Boolean);
  const runs: Run[] = [];
  const stack: Array<{ tag: string; style: TextStyle }> = [];
  let current: TextStyle = {};

  const append = (text: string) => {
    const decoded = decodeRichTextEntities(text);
    if (decoded) runs.push({ text: decoded, style: { ...current } });
  };
  const newline = () => {
    if (!runs.length || !runs[runs.length - 1].text.endsWith("\n")) append("\n");
  };

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      append(token);
      continue;
    }

    const closing = /^<\//.test(token);
    const tag = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase() ?? "";
    if (tag === "br") {
      newline();
      continue;
    }
    if (tag === "li" && !closing) {
      newline();
      append("• ");
    }
    if ((tag === "p" || tag === "li" || tag === "ul" || tag === "ol") && closing) newline();

    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) {
        current = index > 0 ? { ...stack[index - 1].style } : {};
        stack.splice(index);
      }
      continue;
    }

    const next = { ...current };
    if (tag === "strong" || tag === "b") next.fontWeight = "800";
    if (tag === "em" || tag === "i") next.fontStyle = "italic";
    if (tag === "u") next.textDecorationLine = "underline";
    if (tag === "span" || tag === "font") {
      const color = token.match(/(?:color\s*:\s*|color=["']?)(#[0-9a-f]{6})/i)?.[1];
      if (color) next.color = color;
    }
    if (["strong", "b", "em", "i", "u", "span", "font"].includes(tag)) {
      stack.push({ tag, style: next });
      current = next;
    }
  }

  while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop();
  return runs;
}

export function RichCommentView({ value, style, numberOfLines, testID }: Props) {
  const runs = useMemo(() => parseRichText(value ?? ""), [value]);
  if (!runs.length) return null;
  return (
    <Text style={[styles.text, style]} numberOfLines={numberOfLines} testID={testID}>
      {runs.map((run, index) => <Text key={`${index}-${run.text.slice(0, 8)}`} style={run.style}>{run.text}</Text>)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
});
