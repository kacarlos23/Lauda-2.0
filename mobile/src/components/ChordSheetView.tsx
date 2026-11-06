import { memo, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { parseChordSheet } from "../utils/chordEngine";
import { colors, fontFamilies, fontSizes, fontWeights, spacing } from "../theme";

type Props = { content: string; originalKey: string; semitones: number; fontSize: number };

export const ChordSheetView = memo(function ChordSheetView({ content, originalKey, semitones, fontSize }: Props) {
  const sheet = useMemo(() => parseChordSheet(content, semitones, originalKey), [content, originalKey, semitones]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [sourceWidth, setSourceWidth] = useState(0);
  let previousType = "none";

  if (sheet.traditionalRows) return <View accessibilityLabel="Cifra da música">
    {sourceWidth > viewportWidth && viewportWidth > 0 ? <Text style={styles.scrollHint} testID="traditional-scroll-hint">Deslize na horizontal para ver linhas longas.</Text> : null}
    <ScrollView horizontal nestedScrollEnabled testID="traditional-sheet-scroll"
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onContentSizeChange={(width) => setSourceWidth(width)}>
      <View style={styles.traditionalContent}>
        {sheet.traditionalRows.map((row, index) => <Text key={index} selectable
          testID={`traditional-row-${index}`}
          style={[styles.traditionalRow, row.chord && styles.traditionalChord, { fontSize, lineHeight: fontSize * 1.45 }]}
        >{row.text || " "}</Text>)}
      </View>
    </ScrollView>
  </View>;

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

const styles = StyleSheet.create({
  traditionalContent: { alignItems: "flex-start" },
  scrollHint: { color: colors.muted, fontSize: fontSizes.s11, marginBottom: spacing.sm },
  traditionalRow: { color: colors.ink, fontFamily: fontFamilies.monospace, flexShrink: 0 },
  traditionalChord: { color: colors.primary, fontWeight: fontWeights.extrabold },
  line: { minHeight: 8 },
  segments: { flexDirection: "row", flexWrap: "wrap" },
  segment: { flexShrink: 0 },
  chord: { color: colors.primary, fontWeight: fontWeights.extrabold, fontFamily: fontFamilies.monospace },
  lyric: { color: colors.ink, fontFamily: fontFamilies.monospace },
  section: { color: colors.muted, fontSize: fontSizes.s11, fontWeight: fontWeights.extrabold, marginTop: spacing.md, marginBottom: spacing.xs },
});

