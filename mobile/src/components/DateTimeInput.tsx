import React, { useRef, useState } from "react";
import type { KeyboardTypeOptions, StyleProp, ViewStyle } from "react-native";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar, Clock } from "lucide-react-native";
import { colors, radii, spacing } from "../theme";
import { maskDateInput, maskTimeInput, parseDisplayDate, toDisplayDate } from "../utils/dateTimeInput";

const DATE_POPOVER_WIDTH = 292;
const DATE_POPOVER_HEIGHT = 314;
const TIME_POPOVER_WIDTH = 238;
const TIME_POPOVER_HEIGHT = 238;
const POPOVER_GAP = 8;

interface DateTimeInputProps {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  maskInput?: boolean;
  testID?: string;
}

export function DateTimeInput({
  type,
  value,
  onChange,
  label,
  placeholder,
  maxLength,
  keyboardType = "number-pad",
  containerStyle,
  error,
  maskInput = true,
  testID,
}: DateTimeInputProps) {
  const Icon = type === "date" ? Calendar : Clock;
  const inputWrapperRef = useRef<View | null>(null);
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => parseDisplayDate(value) ?? new Date());
  const [popoverPosition, setPopoverPosition] = useState({ top: spacing.md, left: spacing.md });
  const resolvedMaxLength = maxLength ?? (type === "date" ? 10 : 5);
  const selectedDate = type === "date" ? parseDisplayDate(value) : null;
  const calendarDays = Array.from({ length: new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0).getDate() }, (_, index) => new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), index + 1));
  const calendarPadding = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1).getDay();
  const timeOptions = Array.from({ length: 36 }, (_, index) => {
    const totalMinutes = 6 * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });

  const handleChange = (nextValue: string) => {
    if (!maskInput) {
      onChange(nextValue);
      return;
    }

    onChange(type === "date" ? maskDateInput(nextValue) : maskTimeInput(nextValue));
  };

  const placePopover = () => {
    const popoverWidth = type === "date" ? DATE_POPOVER_WIDTH : TIME_POPOVER_WIDTH;
    const popoverHeight = type === "date" ? DATE_POPOVER_HEIGHT : TIME_POPOVER_HEIGHT;
    const windowSize = Dimensions.get("window");
    const fallbackLeft = Math.max(spacing.md, (windowSize.width - popoverWidth) / 2);
    const fallbackTop = Math.max(spacing.md, windowSize.height / 2 - popoverHeight / 2);
    const measure = inputWrapperRef.current?.measureInWindow;

    if (typeof measure !== "function") {
      setPopoverPosition({ top: fallbackTop, left: fallbackLeft });
      return;
    }

    measure((x, y, width) => {
      const left = Math.max(spacing.md, Math.min(x + width - popoverWidth, windowSize.width - popoverWidth - spacing.md));
      const preferredTop = y - popoverHeight - POPOVER_GAP;
      const top = Math.max(spacing.md, preferredTop);
      setPopoverPosition({ top, left });
    });
  };

  const openPicker = () => {
    if (type === "date") {
      setPickerMonth(parseDisplayDate(value) ?? new Date());
    }
    placePopover();
    setPickerOpen((current) => !current);
  };

  const selectDate = (date: Date) => {
    onChange(toDisplayDate(date));
    setPickerOpen(false);
  };

  const selectTime = (time: string) => {
    onChange(time);
    setPickerOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View ref={inputWrapperRef} style={[styles.inputWrapper, focused && styles.inputWrapperFocused, error && styles.inputWrapperError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? (type === "date" ? "DD/MM/AAAA" : "HH:MM")}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          maxLength={maskInput ? resolvedMaxLength : maxLength}
          testID={testID}
        />
        <TouchableOpacity
          style={styles.iconButton}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={type === "date" ? "Abrir calendário" : "Abrir seletor de horário"}
          testID={testID ? `${testID}-picker` : undefined}
        >
          <Icon color={colors.muted} size={20} strokeWidth={2.3} />
        </TouchableOpacity>
      </View>
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.dismissLayer}
            onPress={() => setPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={type === "date" ? "Fechar calendário" : "Fechar seletor de horário"}
          />
          <View style={[styles.popover, type === "date" ? styles.datePopover : styles.timePopover, { top: popoverPosition.top, left: popoverPosition.left }]}>
            {type === "date" ? (
              <>
                <View style={styles.popoverHeader}>
                  <TouchableOpacity style={styles.navButton} onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))} accessibilityRole="button" accessibilityLabel="Mês anterior">
                    <Text style={styles.navText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.popoverTitle}>{pickerMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
                  <TouchableOpacity style={styles.navButton} onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))} accessibilityRole="button" accessibilityLabel="Próximo mês">
                    <Text style={styles.navText}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.weekRow}>{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
                <View style={styles.calendarGrid}>
                  {Array.from({ length: calendarPadding }).map((_, index) => <View key={`empty-${index}`} style={styles.calendarDay} />)}
                  {calendarDays.map((day) => {
                    const selected = selectedDate?.getFullYear() === day.getFullYear() && selectedDate.getMonth() === day.getMonth() && selectedDate.getDate() === day.getDate();
                    return (
                      <TouchableOpacity key={day.toISOString()} style={[styles.calendarDay, selected && styles.calendarDaySelected]} onPress={() => selectDate(day)} accessibilityRole="button" accessibilityLabel={`Selecionar dia ${day.getDate()}`}>
                        <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>{day.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.popoverTitle}>Horário</Text>
                <ScrollView style={styles.timeList} keyboardShouldPersistTaps="handled">
                  <View style={styles.timeGrid}>
                    {timeOptions.map((time) => {
                      const selected = time === value;
                      return (
                        <TouchableOpacity key={time} style={[styles.timeOption, selected && styles.timeOptionSelected]} onPress={() => selectTime(time)} accessibilityRole="button" accessibilityLabel={`Selecionar horário ${time}`}>
                          <Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected]}>{time}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}
            </View>
        </View>
      </Modal>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  overlay: {
    flex: 1,
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  popover: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    elevation: 8,
  },
  datePopover: {
    width: DATE_POPOVER_WIDTH,
    minHeight: DATE_POPOVER_HEIGHT,
  },
  timePopover: {
    width: TIME_POPOVER_WIDTH,
    maxHeight: TIME_POPOVER_HEIGHT,
  },
  popoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  popoverTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "capitalize",
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  navText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  weekRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  calendarDayTextSelected: {
    color: colors.surface,
  },
  timeList: {
    maxHeight: 180,
    marginTop: spacing.sm,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  timeOption: {
    width: 62,
    height: 34,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  timeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timeOptionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  timeOptionTextSelected: {
    color: colors.surface,
  },
});
