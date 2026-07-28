import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Member } from "../types";
import { colors, fontSizes, fontWeights, radii, spacing } from "../theme";
import { memberMatchesRoleInstrument, prioritizeMembersByRole } from "../utils/memberInstrumentPriority";

type Props = {
  members: Member[];
  roleText: string;
  selectedMemberId?: string | null;
  onSelect: (member: Member) => void;
};

function readableTextColor(backgroundColor?: string | null): string {
  if (!backgroundColor || !/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) return colors.primaryDark;

  const red = parseInt(backgroundColor.slice(1, 3), 16);
  const green = parseInt(backgroundColor.slice(3, 5), 16);
  const blue = parseInt(backgroundColor.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? colors.ink : colors.surface;
}

export function MemberPickerWithInstrumentPriority({ members, roleText, selectedMemberId, onSelect }: Props) {
  const prioritizedMembers = prioritizeMembersByRole(members, roleText);

  return (
    <FlatList
      data={prioritizedMembers}
      keyExtractor={(member) => member.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const selected = item.id === selectedMemberId;
        const compatible = memberMatchesRoleInstrument(item, roleText);

        return (
          <TouchableOpacity
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`Selecionar ${item.name}`}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.name}>{item.name}</Text>
              {compatible ? (
                <View style={styles.compatibleBadge}>
                  <Text style={styles.compatibleText}>Compatível</Text>
                </View>
              ) : null}
            </View>
            {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
            {item.instruments?.length ? (
              <View style={styles.instrumentList}>
                {item.instruments.map((instrument) => {
                  const chipColor = instrument.colorHex ?? colors.primarySoft;
                  return (
                    <View
                      key={instrument.id}
                      style={[
                        styles.instrumentChip,
                        {
                          backgroundColor: chipColor,
                          borderColor: instrument.colorHex ?? colors.line,
                        },
                      ]}
                    >
                      <Text style={[styles.instrumentChipText, { color: readableTextColor(instrument.colorHex) }]}>
                        {instrument.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noInstruments}>Nenhum instrumento informado</Text>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.s15,
    fontWeight: fontWeights.extrabold,
  },
  email: {
    color: colors.muted,
    fontSize: fontSizes.s12,
    fontWeight: fontWeights.semibold,
  },
  compatibleBadge: {
    minHeight: 26,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  compatibleText: {
    color: colors.surface,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.extrabold,
  },
  instrumentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  instrumentChip: {
    minHeight: 26,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentChipText: {
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.extrabold,
  },
  noInstruments: {
    color: colors.muted,
    fontSize: fontSizes.s12,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.xs,
  },
});
