import { Animated, Easing } from "react-native";
import { desktopIndicatorEasing, stagingTransitionMs } from "../tokens/stagingNavigation";

export const STAGING_SCENE_INPUT_RANGE = [-1, -0.55, -0.25, 0, 0.25, 0.55, 1] as const;
export const STAGING_SCENE_OUTPUT_RANGE = [0, 0.62, 0.92, 1, 0.92, 0.62, 0] as const;

export const stagingSceneTransitionSpec = {
  animation: "timing" as const,
  config: {
    duration: stagingTransitionMs.scene,
    easing: Easing.bezier(...desktopIndicatorEasing),
  },
};

/**
 * Pure concave opacity cross-fade so the header stays anchored while screens
 * dissolve without a hard cut or brightness dip.
 */
export function stagingSceneStyleInterpolator({
  current,
}: {
  current: { progress: Animated.Value };
}) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [...STAGING_SCENE_INPUT_RANGE],
        outputRange: [...STAGING_SCENE_OUTPUT_RANGE],
        extrapolate: "clamp",
      }),
    },
  };
}

/**
 * Returns bottom-tab screen transition options, honoring reduced motion.
 */
export function stagingScreenTransitionOptions(enabled: boolean, reducedMotion: boolean) {
  if (enabled && !reducedMotion) {
    return {
      transitionSpec: stagingSceneTransitionSpec,
      sceneStyleInterpolator: stagingSceneStyleInterpolator,
    };
  }
  return { animation: "none" as const };
}
