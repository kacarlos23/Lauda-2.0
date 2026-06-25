import { memo, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { parseChordSheet } from "../utils/chordEngine";
import { colors, spacing } from "../theme";

type Props = { content: string; originalKey: string; semitones: number; fontSize: number };

export const ChordSheetView = memo(function ChordSheetView({ content, originalKey, semitones, fontSize }: Props) {
  const sheet = useMemo(() => parseChordSheet(content, semitones, originalKey), [content, originalKey, semitones]);
  let previousType = "none";

  return <View accessibilityLabel="Cifra da música">
    {sheet.lines.map((line, lineIndex) => {
      const showSection = line.type !== "none" && line.type !== previousType;
      previousType = line.type;
      return <View key={lineIndex} style={styles.line}>
        {showSection ? <Text style={styles.section}>{line.type.toUpperCase()}</Text> : null}
        {line.segments.length ? <View style={styles.segments}>
          {line.segments.map((segment, segmentIndex) => <View key={segmentIndex} style={styles.segment}>
            <Text selectable style={[styles.chord, { fontSize, lineHeight: fontSize * 1.35 }]}>{segment.chord || " "}</Text>
            <Text selectable style={[styles.lyric, { fontSize, lineHeight: fontSize * 1.45 }]}>{segment.lyrics || " "}</Text>
          </View>)}
        </View> : <View style={{ height: fontSize * 0.8 }} />}
      </View>;
    })}
  </View>;
});

const mono = Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" });
const styles = StyleSheet.create({
  line: { minHeight: 8 },
  segments: { flexDirection: "row", flexWrap: "wrap" },
  segment: { flexShrink: 0 },
  chord: { color: colors.primary, fontWeight: "800", fontFamily: mono },
  lyric: { color: colors.ink, fontFamily: mono },
  section: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.xs },
});
