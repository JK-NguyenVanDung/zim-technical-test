import { Image } from "expo-image";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

const TILT_MAX_DEG = Platform.OS === "web" ? 16 : 4;
const PARALLAX_IMAGE_PX = 22;
const PARALLAX_CAPTION_PX = 10;

import type { MomentPalette } from "@/components/moments/MomentPalette";
import type { ZimMoment } from "@/types/moment";

type MomentCardProps = {
  index: number;
  isPreviewed: boolean;
  isPending: boolean;
  itemWidth: number;
  moment: ZimMoment;
  onPress: (id: string) => void;
  onPreview: (id: string) => void;
  onTiltActiveChange?: (active: boolean) => void;
  palette: MomentPalette;
  reducedMotion: boolean;
  snapInterval: number;
  scrollX: Animated.Value;
};

function MomentCardComponent({
  index,
  isPreviewed,
  isPending,
  itemWidth,
  moment,
  onPress,
  onPreview,
  onTiltActiveChange,
  palette,
  reducedMotion,
  snapInterval,
  scrollX,
}: MomentCardProps) {
  const hoverProgress = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const ringFill = useRef(new Animated.Value(0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const cardSizeRef = useRef({ width: 0, height: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const edgeGestureRef = useRef(false);
  // Tilt is gated behind a short hold — taps never engage it
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiltReadyRef = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Fraction of card width treated as an edge zone, scroll wins here
  const EDGE_FRACTION = 0.2;

  const touchHandlers = useMemo(() => {
    const updateTilt = (locationX: number, locationY: number) => {
      const { width, height } = cardSizeRef.current;
      if (!width || !height) return;
      const nx = Math.max(-1, Math.min(1, (locationX / width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, (locationY / height) * 2 - 1));
      tiltX.setValue(-ny);
      tiltY.setValue(nx);
    };
    const release = () => {
      onTiltActiveChange?.(false);
      Animated.parallel([
        Animated.spring(tiltX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 6,
          tension: 90,
        }),
        Animated.spring(tiltY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 6,
          tension: 90,
        }),
      ]).start();
    };
    const cancelHold = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      tiltReadyRef.current = false;
    };
    const releaseWithCancel = () => {
      cancelHold();
      if (isPreviewed && !reducedMotion) {
        release();
      }
    };
    return {
      onTouchStart: (e: GestureResponderEvent) => {
        const { width } = cardSizeRef.current;
        const lx = e.nativeEvent.locationX;
        const inEdgeZone =
          width > 0 &&
          (lx < width * EDGE_FRACTION || lx > width * (1 - EDGE_FRACTION));

        touchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        draggedRef.current = false;
        tiltReadyRef.current = false;
        edgeGestureRef.current = inEdgeZone;

        if (reducedMotion || !isPreviewed) return;

        // Snapshot coords NOW — the event object is pooled and nulled
        // by the time setTimeout fires 180ms later.
        const startLX = e.nativeEvent.locationX;
        const startLY = e.nativeEvent.locationY;
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          if (draggedRef.current) return; // finger moved — skip tilt
          tiltReadyRef.current = true;
          onTiltActiveChange?.(true);
          updateTilt(startLX, startLY);
        }, 180);
      },
      onTouchMove: (e: GestureResponderEvent) => {
        const start = touchStartRef.current;
        if (start) {
          const dx = e.nativeEvent.pageX - start.x;
          const dy = e.nativeEvent.pageY - start.y;
          if (Math.hypot(dx, dy) > 8) {
            draggedRef.current = true;
            // Significant movement before tilt is ready → cancel hold timer
            if (!tiltReadyRef.current) {
              cancelHold();
              // Predominantly horizontal drag → yield to carousel.
              // Edge zone uses a lower ratio so edge swipes still feel natural.
              const threshold = edgeGestureRef.current ? 1.0 : 1.2;
              if (Math.abs(dx) > Math.abs(dy) * threshold) {
                releaseWithCancel();
                edgeGestureRef.current = true;
                return;
              }
            }
          }
        }
        
        if (reducedMotion || !isPreviewed) return;

        // Only update tilt visuals once the hold threshold has been passed
        if (!tiltReadyRef.current) return;
        updateTilt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onTouchEnd: releaseWithCancel,
      onTouchCancel: releaseWithCancel,
    };
  }, [reducedMotion, isPreviewed, onTiltActiveChange, tiltX, tiltY]);

  useEffect(() => {
    if (!isPreviewed) {
      // Cancel pending hold timer so tilt cannot fire on a de-focused card
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      tiltReadyRef.current = false;
      draggedRef.current = false;
      tiltX.stopAnimation();
      tiltY.stopAnimation();
      tiltX.setValue(0);
      tiltY.setValue(0);
    }
  }, [isPreviewed, tiltX, tiltY]);

  useEffect(() => {
    Animated.timing(hoverProgress, {
      duration: reducedMotion ? 0 : 180,
      toValue: isPreviewed || pressed ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [hoverProgress, isPreviewed, pressed, reducedMotion]);

  useEffect(() => {
    if (!isPending) {
      ringRotate.stopAnimation();
      ringFill.stopAnimation();
      ringRotate.setValue(0);
      ringFill.setValue(0);
      return;
    }

    if (!reducedMotion) {
      Animated.loop(
        Animated.timing(ringRotate, {
          duration: 1100,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: true,
        }),
      ).start();
    }
    Animated.timing(ringFill, {
      duration: reducedMotion ? 0 : 2000,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [isPending, reducedMotion, ringFill, ringRotate]);

  const scrollStyle = useMemo(() => {
    if (reducedMotion) {
      return undefined;
    }

    const center = index * snapInterval;
    const inputRange = [center - snapInterval, center, center + snapInterval];

    return {
      opacity: scrollX.interpolate({
        inputRange,
        outputRange: [0.58, 1, 0.58],
        extrapolate: "clamp",
      }),
      transform: [
        {
          scale: scrollX.interpolate({
            inputRange,
            outputRange: [0.82, 1, 0.82],
            extrapolate: "clamp",
          }),
        },
        {
          translateY: scrollX.interpolate({
            inputRange,
            outputRange: [28, 0, 28],
            extrapolate: "clamp",
          }),
        },
      ],
    };
  }, [index, reducedMotion, scrollX, snapInterval]);

  const tiltRotateX = tiltX.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${TILT_MAX_DEG}deg`, `${TILT_MAX_DEG}deg`],
  });
  const tiltRotateY = tiltY.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${TILT_MAX_DEG}deg`, `${TILT_MAX_DEG}deg`],
  });

  const hoverStyle = reducedMotion
    ? undefined
    : {
        transform: [
          { perspective: 900 },
          {
            translateY: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -10],
            }),
          },
          {
            scale: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.025],
            }),
          },
          { rotateX: tiltRotateX },
          { rotateY: tiltRotateY },
        ],
      };

  const imageStyle = reducedMotion
    ? undefined
    : {
        transform: [
          {
            translateX: tiltY.interpolate({
              inputRange: [-1, 1],
              outputRange: [-PARALLAX_IMAGE_PX, PARALLAX_IMAGE_PX],
            }),
          },
          {
            translateY: Animated.add(
              hoverProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
              tiltX.interpolate({
                inputRange: [-1, 1],
                outputRange: [PARALLAX_IMAGE_PX, -PARALLAX_IMAGE_PX],
              }),
            ),
          },
          {
            scale: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1.04, 1.1],
            }),
          },
        ],
      };

  const overlayStyle = {
    opacity: reducedMotion
      ? 1
      : hoverProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.76, 1],
        }),
  };

  const captionStyle = reducedMotion
    ? undefined
    : {
        opacity: hoverProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
        transform: [
          {
            translateX: tiltY.interpolate({
              inputRange: [-1, 1],
              outputRange: [PARALLAX_CAPTION_PX, -PARALLAX_CAPTION_PX],
            }),
          },
          {
            translateY: Animated.add(
              hoverProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
              tiltX.interpolate({
                inputRange: [-1, 1],
                outputRange: [-PARALLAX_CAPTION_PX, PARALLAX_CAPTION_PX],
              }),
            ),
          },
        ],
      };

  const ringRotation = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const ringScale = ringFill.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.08],
  });

  return (
    <Animated.View style={[styles.outer, scrollStyle, { width: itemWidth }]}>
      <Animated.View style={hoverStyle}>
        <Pressable
          {...touchHandlers}
          accessibilityHint={
            isPreviewed
              ? "Chạm lần nữa để mở khoảnh khắc toàn màn hình"
              : "Chạm để đưa thẻ vào giữa, giữ 2 giây để mở"
          }
          accessibilityLabel={`Khoảnh khắc video ${moment.title}, ${moment.location}`}
          accessibilityRole="button"
          onBlur={() => {
            setPressed(false);
            setIsFocused(false);
          }}
          onFocus={() => {
            setIsFocused(true);
            onPreview(moment.id);
          }}
          onHoverIn={() => onPreview(moment.id)}
          onLayout={(e) => {
            cardSizeRef.current = {
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
          }}
          onPress={() => {
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            onPress(moment.id);
          }}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: isFocused
                ? palette.text
                : isPreviewed
                  ? palette.border
                  : "rgba(255, 255, 255, 0.18)",
            },
            isFocused &&
              Platform.OS === "web" &&
              ({
                outlineColor: palette.text,
                outlineStyle: "solid",
                outlineWidth: 3,
              } as any),
          ]}
        >
          <View style={styles.mediaFrame}>
            <Animated.View style={[styles.imageLayer, imageStyle]}>
              <Image
                accessibilityIgnoresInvertColors
                contentFit="cover"
                recyclingKey={moment.id}
                source={{ uri: moment.thumbnailUrl }}
                style={styles.image}
                transition={reducedMotion ? 0 : 180}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.overlay,
                overlayStyle,
                { backgroundColor: palette.overlay },
              ]}
            />
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            {isPending ? (
              <View pointerEvents="none" style={styles.ringWrap}>
                <Animated.View
                  style={[
                    styles.ringSpinner,
                    {
                      borderTopColor: palette.tint,
                      transform: [
                        { rotate: ringRotation },
                        { scale: ringScale },
                      ],
                    },
                  ]}
                />
              </View>
            ) : null}
            {isPreviewed ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.captionLayer, captionStyle]}
              >
                <Text numberOfLines={2} selectable style={styles.cardTitle}>
                  {moment.location}
                </Text>
                <Text numberOfLines={2} selectable style={styles.cardCaption}>
                  {moment.caption}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export const MomentCard = memo(MomentCardComponent);

const styles = StyleSheet.create({
  outer: {
    justifyContent: "center",
  },
  card: {
    aspectRatio: 9 / 16,
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
  },
  mediaFrame: {
    flex: 1,
    overflow: "hidden",
  },
  imageLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  playButton: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.68)",
    borderRadius: 999,
    borderWidth: 4,
    height: 74,
    justifyContent: "center",
    left: "50%",
    marginLeft: -37,
    marginTop: -37,
    position: "absolute",
    top: "50%",
    width: 74,
  },
  playIcon: {
    color: "#FFFFFF",
    fontSize: 36,
    lineHeight: 42,
    marginLeft: 5,
  },
  ringWrap: {
    alignItems: "center",
    height: 96,
    justifyContent: "center",
    left: "50%",
    marginLeft: -48,
    marginTop: -48,
    position: "absolute",
    top: "50%",
    width: 96,
  },
  ringSpinner: {
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    borderWidth: 4,
    height: 96,
    width: 96,
  },
  captionLayer: {
    bottom: 20,
    gap: 5,
    left: 12,
    position: "absolute",
    right: 12,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardCaption: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
