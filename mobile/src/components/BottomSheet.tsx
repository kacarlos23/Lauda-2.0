import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  motion,
  overlays,
  radii,
  radiusValues,
  shadow,
  spacing,
} from "../theme";
import { ArrowLeft, X } from "lucide-react-native";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function BottomSheet({ isOpen, onClose, onBack, title, children, footer }: BottomSheetProps) {
  const [modalVisible, setModalVisible] = useState(isOpen);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: motion.sheetOpenMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.sheetOpenMs,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: motion.sheetCloseMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: motion.sheetCloseMs,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [isOpen, translateY, opacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SCREEN_HEIGHT * 0.2 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!modalVisible && !isOpen) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>
        
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          <View style={styles.dragHandleTouch} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <View style={[styles.header, onBack && styles.headerWithBack]}>
            {onBack ? (
              <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar">
                <ArrowLeft color={colors.ink} size={iconSizes.s24} />
              </Pressable>
            ) : (
              <View style={styles.headerPlaceholder} />
            )}
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <X color={colors.ink} size={iconSizes.s24} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlays.modal,
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "90%",
    overflow: "hidden",
    ...shadow,
  },
  dragHandleTouch: {
    minHeight: 20,
    width: 80,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: controlSizes.medium,
    height: 4,
    backgroundColor: colors.line,
    borderRadius: radiusValues.r2,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerWithBack: {
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSizes.s20,
    fontWeight: fontWeights.black,
    color: colors.ink,
    textAlign: "center",
  },
  backBtn: {
    minWidth: 44,
    minHeight: controlSizes.default,
    padding: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    minWidth: 44,
    minHeight: controlSizes.default,
    padding: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPlaceholder: {
    width: controlSizes.default,
    height: controlSizes.default,
  },
  content: {
    flexShrink: 1,
  },
  contentContainer: { paddingBottom: spacing.md },
  footer: {
    flexShrink: 0,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
});
