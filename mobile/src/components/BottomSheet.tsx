import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useSafeInsets } from "../hooks/useSafeInsets";
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
  breakpoints,
  typography,
} from "../theme";
import { ArrowLeft, X } from "lucide-react-native";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  presentation?: "sheet" | "modal";
  sheetStyle?: StyleProp<ViewStyle>;
  onShow?: () => void;
  onClosed?: () => void;
  reduceMotion?: boolean;
  animationDuration?: number;
  openDuration?: number;
  closeDuration?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function BottomSheet({ isOpen, onClose, onBack, title, children, footer, presentation = "sheet", sheetStyle,
  onShow, onClosed, reduceMotion = false, animationDuration, openDuration, closeDuration }: BottomSheetProps) {
  const insets = useSafeInsets();
  const dimensions = typeof useWindowDimensions === "function" ? useWindowDimensions() : { width: 390, height: 844 };
  const wide = dimensions.width >= breakpoints.mobile;
  const fixedModal = presentation === "modal";
  const mobileSheet = !wide && !fixedModal && Platform.OS !== "web";
  const useNativeDriver = Platform.OS !== "web";
  const windowHeight = (dimensions as { height?: number }).height || SCREEN_HEIGHT;
  const slideDistance = animationDuration != null
    ? 8
    : Math.min(Math.max(Math.round(windowHeight * 0.45), 220), 380);
  const [modalVisible, setModalVisible] = useState(isOpen);
  const translateY = useRef(new Animated.Value(slideDistance)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(animationDuration != null ? 0 : 0.92)).current;
  const wasOpenRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      opacity.setValue(isOpen ? 1 : 0);
      sheetOpacity.setValue(isOpen ? 1 : 0);
      wasOpenRef.current = isOpen;
      setModalVisible(isOpen);
      if (!isOpen && modalVisible) onClosedRef.current?.();
      return;
    }

    const openEasing = typeof Easing?.bezier === "function" ? Easing.bezier(0.22, 1, 0.36, 1) : undefined;
    const closeEasing = typeof Easing?.bezier === "function" ? Easing.bezier(0.4, 0, 1, 1) : undefined;
    const backdropEasing = typeof Easing?.out === "function" && typeof Easing?.cubic === "function"
      ? Easing.out(Easing.cubic)
      : undefined;

    if (isOpen) {
      setModalVisible(true);
      if (!wasOpenRef.current) {
        translateY.setValue(slideDistance);
        opacity.setValue(0);
        sheetOpacity.setValue(animationDuration != null ? 0 : 0.92);
        wasOpenRef.current = true;
      }
      const openMs = openDuration ?? animationDuration ?? motion.sheetOpenMs;
      const animation = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: openMs,
          easing: openEasing,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: Math.min(openMs, 260),
          easing: backdropEasing,
          useNativeDriver,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: Math.min(openMs, 180),
          easing: backdropEasing,
          useNativeDriver,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }

    if (modalVisible) {
      wasOpenRef.current = false;
      const closeMs = closeDuration ?? animationDuration ?? motion.sheetCloseMs;
      const animation = Animated.parallel([
        Animated.timing(translateY, {
          toValue: slideDistance,
          duration: closeMs,
          easing: closeEasing,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: closeMs,
          easing: closeEasing,
          useNativeDriver,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: closeMs,
          easing: closeEasing,
          useNativeDriver,
        }),
      ]);
      animation.start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
          onClosedRef.current?.();
        }
      });
      return () => animation.stop();
    }

    return undefined;
  }, [isOpen, translateY, opacity, sheetOpacity, reduceMotion, animationDuration, openDuration, closeDuration, slideDistance, useNativeDriver]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (!reduceMotionRef.current && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SCREEN_HEIGHT * 0.2 || gestureState.vy > 0.5) {
          onClose();
        } else {
          if (reduceMotionRef.current) {
            translateY.setValue(0);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver,
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
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
      onShow={onShow}
    >
      <View style={[styles.overlay, wide && styles.overlayWide, fixedModal && styles.overlayModal]}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>
        
        <Animated.View
          style={[
            styles.sheet,
            (wide || fixedModal) && styles.sheetWide,
            !fixedModal && { transform: [{ translateY }], opacity: sheetOpacity },
            fixedModal && animationDuration != null && { opacity: sheetOpacity },
            sheetStyle,
          ]}
        >
          {!fixedModal && <View style={styles.dragHandleTouch} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>}
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
            contentContainerStyle={[
              styles.contentContainer,
              mobileSheet && !footer && { paddingBottom: spacing.md + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
          {footer && (
            <View style={[styles.footer, mobileSheet && { paddingBottom: spacing.xl + insets.bottom }]}>
              {footer}
            </View>
          )}
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
  overlayWide: { justifyContent: "center", padding: spacing.xl },
  overlayModal: { justifyContent: "center", padding: spacing.md },
  sheetWide: { width: "100%", maxWidth: 720, alignSelf: "center", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line },
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
    maxHeight: "88%",
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
    ...typography.sectionTitle,
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
