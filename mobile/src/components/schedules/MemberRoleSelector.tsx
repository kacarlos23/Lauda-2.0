import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, ChevronDown, UserRound, X } from "lucide-react-native";
import { Member } from "../../types";
import { colors, fontSizes, fontWeights, iconSizes, radii, spacing } from "../../theme";

export type SelectedMemberRole = { userId: string; role: string };

type Props = {
  members: Member[];
  value: SelectedMemberRole[];
  onChange: (value: SelectedMemberRole[]) => void;
};

export function hasIncompleteMemberRoles(value: SelectedMemberRole[]) {
  return value.some((assignment) => !assignment.role.trim());
}

export function MemberRoleSelector({ members, value, onChange }: Props) {
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const selectedById = useMemo(() => new Map(value.map((item) => [item.userId, item])), [value]);

  const toggle = (member: Member) => {
    const selected = selectedById.get(member.id);
    if (selected) {
      onChange(value.filter((item) => item.userId !== member.id));
      if (openMemberId === member.id) setOpenMemberId(null);
      return;
    }
    if (!member.instruments?.length) return;
    onChange([...value, { userId: member.id, role: "" }]);
    setOpenMemberId(member.id);
  };

  const chooseRole = (memberId: string, role: string) => {
    onChange(value.map((item) => item.userId === memberId ? { ...item, role } : item));
    setOpenMemberId(null);
  };

  return (
    <View style={styles.list}>
      {members.map((member) => {
        const selected = selectedById.get(member.id);
        const instruments = (member.instruments ?? []).filter((instrument) => instrument.isActive !== false && !instrument.deletedAt);
        const historicalRole = selected?.role && !instruments.some((instrument) => instrument.name === selected.role)
          ? selected.role
          : null;
        const unavailable = !selected && instruments.length === 0;
        const expanded = openMemberId === member.id && Boolean(selected);

        return (
          <View key={member.id} style={[styles.memberCard, selected && styles.memberCardSelected, unavailable && styles.memberCardDisabled]}>
            <View style={styles.memberRow}>
              <TouchableOpacity
                style={styles.memberChoice}
                onPress={() => toggle(member)}
                disabled={unavailable}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(selected), disabled: unavailable }}
                accessibilityLabel={`${selected ? "Remover" : "Adicionar"} ${member.name}`}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Check color={colors.inverse} size={iconSizes.s16} strokeWidth={2.8} /> : <UserRound color={colors.muted} size={iconSizes.s16} />}
                </View>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {unavailable ? (
                    <Text style={styles.warning}>Sem função ativa. Oriente o membro a atualizar o perfil.</Text>
                  ) : (
                    <Text style={styles.memberMeta}>{instruments.length} função(ões) disponível(is)</Text>
                  )}
                </View>
              </TouchableOpacity>

              {selected ? (
                <TouchableOpacity
                  style={[styles.roleButton, !selected.role && styles.roleButtonInvalid]}
                  onPress={() => setOpenMemberId(expanded ? null : member.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Escolher função de ${member.name}`}
                >
                  <View style={styles.roleTextRow}>
                    {selected.role ? <View style={[styles.roleDot, { backgroundColor: instruments.find((item) => item.name === selected.role)?.colorHex ?? colors.warning }]} /> : null}
                    <Text style={[styles.roleButtonText, !selected.role && styles.placeholder]} numberOfLines={1}>
                      {selected.role || "Escolher função *"}
                    </Text>
                  </View>
                  <ChevronDown color={colors.primary} size={iconSizes.s16} />
                </TouchableOpacity>
              ) : null}
            </View>

            {historicalRole ? (
              <View style={styles.historicalRow}>
                <Text style={styles.historicalText}>Função histórica — pode ser preservada nesta escala.</Text>
              </View>
            ) : null}

            {expanded ? (
              <View style={styles.roleMenu}>
                {instruments.map((instrument) => (
                  <TouchableOpacity
                    key={instrument.id}
                    style={[styles.roleOption, selected?.role === instrument.name && styles.roleOptionSelected]}
                    onPress={() => chooseRole(member.id, instrument.name)}
                    accessibilityRole="menuitem"
                  >
                    <View style={[styles.roleDot, { backgroundColor: instrument.colorHex ?? colors.primary }]} />
                    <Text style={styles.roleOptionText}>{instrument.name}</Text>
                    {selected?.role === instrument.name ? <Check color={colors.primary} size={iconSizes.s16} /> : null}
                  </TouchableOpacity>
                ))}
                {historicalRole ? (
                  <TouchableOpacity style={[styles.roleOption, styles.historicalOption]} onPress={() => chooseRole(member.id, historicalRole)}>
                    <View style={[styles.roleDot, { backgroundColor: colors.warning }]} />
                    <Text style={styles.roleOptionText}>{historicalRole} (histórica)</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.removeOption} onPress={() => toggle(member)}>
                  <X color={colors.danger} size={iconSizes.s16} />
                  <Text style={styles.removeText}>Remover da escala</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  memberCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, overflow: "hidden" },
  memberCardSelected: { borderColor: colors.primary },
  memberCardDisabled: { opacity: 0.62 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, flexWrap: "wrap" },
  memberChoice: { flex: 1, minWidth: 210, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  checkbox: { width: 30, height: 30, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberCopy: { flex: 1 },
  memberName: { color: colors.ink, fontSize: fontSizes.s16, fontWeight: fontWeights.semibold },
  memberMeta: { marginTop: 2, color: colors.muted, fontSize: fontSizes.s12 },
  warning: { marginTop: 2, color: colors.danger, fontSize: fontSizes.s12 },
  roleButton: { minWidth: 190, maxWidth: 260, flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  roleButtonInvalid: { borderColor: colors.danger },
  roleTextRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  roleButtonText: { flex: 1, color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.semibold },
  placeholder: { color: colors.danger },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  historicalRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  historicalText: { color: colors.warning, fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  roleMenu: { borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.sm, gap: 2, backgroundColor: colors.background },
  roleOption: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.sm },
  roleOptionSelected: { backgroundColor: colors.primarySoft },
  roleOptionText: { flex: 1, color: colors.ink, fontSize: fontSizes.s14 },
  historicalOption: { borderWidth: 1, borderColor: colors.warning },
  removeOption: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  removeText: { color: colors.danger, fontSize: fontSizes.s14, fontWeight: fontWeights.semibold },
});
