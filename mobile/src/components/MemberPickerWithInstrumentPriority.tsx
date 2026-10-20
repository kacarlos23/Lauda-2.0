import { InstrumentBadge } from "./instruments/InstrumentBadge";
﻿import React from "react";
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
                {item.instruments.map((instrument) => <InstrumentBadge key={instrument.id} instrument={instrument} />)}
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
