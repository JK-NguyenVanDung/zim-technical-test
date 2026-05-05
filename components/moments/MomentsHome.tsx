import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MomentCard } from "@/components/moments/MomentCard";
import { getMomentPalette } from "@/components/moments/MomentPalette";
import {
  getCachedVideoPlayer,
  pauseCachedVideoPlayer,
} from "@/components/moments/VideoCache";
import { useReducedMotionPreference } from "@/hooks/UseReducedMotionPreference";
import type { ZimMoment, ZimMomentsSection } from "@/types/moment";

type MomentsHomeProps = {
  moments: ZimMoment[];
  section: ZimMomentsSection;
};

type CardRenderInfo = {
  index: number;
  item: ZimMoment;
};

type RenderMomentProps = CardRenderInfo & {
  itemWidth: number;
  openMoment: (id: string) => void;
  onTiltActiveChange: (active: boolean) => void;
  palette: ReturnType<typeof getMomentPalette>;
  pendingId: string | undefined;
  previewedId: string | undefined;
  reducedMotion: boolean;
  scrollX: Animated.Value;
  setPreviewedId: (id: string) => void;
  snapInterval: number;
};

const AnimatedMomentList = Animated.createAnimatedComponent(FlatList<ZimMoment>);

const RenderMoment = memo(
  ({
    index,
    item,
    itemWidth,
    openMoment,
    onTiltActiveChange,
    palette,
    pendingId,
    previewedId,
    reducedMotion,
    scrollX,
    setPreviewedId,
    snapInterval,
  }: RenderMomentProps) => (
    <MomentCard
      index={index}
      isPending={pendingId === item.id}
      isPreviewed={previewedId === item.id}
      itemWidth={itemWidth}
      moment={item}
      onPress={openMoment}
      onPreview={setPreviewedId}
      onTiltActiveChange={onTiltActiveChange}
      palette={palette}
      reducedMotion={reducedMotion}
      scrollX={scrollX}
      snapInterval={snapInterval}
    />
  ),
);
RenderMoment.displayName = "RenderMoment";

export function MomentsHome({ moments, section }: MomentsHomeProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<ZimMoment>>(null);
  const [previewedId, setPreviewedId] = useState(moments[0]?.id);
  const [pendingId, setPendingId] = useState<string | undefined>(undefined);
  const [tiltActive, setTiltActive] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const palette = useMemo(() => getMomentPalette(colorScheme), [colorScheme]);

  const cancelPending = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    setPendingId(undefined);
  }, []);

  useEffect(() => () => cancelPending(), [cancelPending]);

  const previewedMoment = useMemo(
    () => moments.find((moment) => moment.id === previewedId),
    [moments, previewedId],
  );

  useEffect(() => {
    if (!previewedMoment?.videoUrl) return;
    const url = previewedMoment.videoUrl;
    getCachedVideoPlayer(url);
    return () => {
      pauseCachedVideoPlayer(url);
    };
  }, [previewedMoment?.videoUrl]);

  const isLandscape = width > height;

  const headingReserve = Platform.select({
    android: isLandscape ? 74 : 130,
    ios: isLandscape ? 84 : 130,
    default: isLandscape ? 80 : 130,
  });

  const bottomBuffer = Platform.select({
    android: isLandscape 
      ? Math.max(insets.bottom + 28, height * 0.10) 
      : Math.max(insets.bottom + 36, height * 0.09),
    ios: isLandscape 
      ? Math.max(insets.bottom + 20, height * 0.08) 
      : Math.max(insets.bottom + 32, height * 0.09),
    default: isLandscape ? 28 : 32,
  });

  const carouselPaddingTop = isLandscape ? 12 : 28;
  const paddingBottom = Platform.select({
    android: isLandscape ? Math.max(insets.bottom, 42) : Math.max(insets.bottom, 20),
    ios: isLandscape ? Math.max(insets.bottom, 34) : Math.max(insets.bottom, 18),
    default: 18,
  });
  const availableCardH =
    height -
    insets.top -
    paddingBottom -
    Platform.select({ android: isLandscape ? 10 : 34, ios: isLandscape ? 14 : 34, default: 34 }) -
    headingReserve -
    18 -
    carouselPaddingTop -
    bottomBuffer;

  const maxWidthFromHeight = Math.max(140, availableCardH * (9 / 16));
  const itemWidth = Math.min(
    Platform.select({ android: isLandscape ? 210 : 290, ios: isLandscape ? 230 : 290, default: 240 }),
    Math.max(160, width * 0.58),
    maxWidthFromHeight,
  );

  const cardHeight = itemWidth * (16 / 9);
  const listHeight = carouselPaddingTop + cardHeight + bottomBuffer;
  const snapInterval = itemWidth + 22;
  const sidePadding = Math.max(18, (width - itemWidth) / 2);

  useEffect(() => {
    if (tiltActive || pendingId || isUserScrolling || reducedMotion) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setPreviewedId((currentId) => {
        const currentIndex = moments.findIndex((m) => m.id === currentId);
        if (currentIndex === -1) return currentId;
        
        const nextIndex = (currentIndex + 1) % moments.length;
        const nextMoment = moments[nextIndex];

        listRef.current?.scrollToOffset({
          animated: true,
          offset: nextIndex * snapInterval,
        });

        return nextMoment.id;
      });
    }, 4000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [tiltActive, pendingId, isUserScrolling, reducedMotion, moments, snapInterval]);

  const openMoment = useCallback(
    (id: string) => {
      if (previewedId === id) {
        cancelPending();
        router.push({ pathname: "/moment/[id]", params: { id } });
        return;
      }

      const nextIndex = moments.findIndex((moment) => moment.id === id);
      if (nextIndex >= 0) {
        listRef.current?.scrollToOffset({
          animated: !reducedMotion,
          offset: nextIndex * snapInterval,
        });
      }

      setPreviewedId(id);

      const target = moments.find((m) => m.id === id);
      if (target?.videoUrl) {
        getCachedVideoPlayer(target.videoUrl);
      }

      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      setPendingId(id);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        setPendingId(undefined);
        router.push({ pathname: "/moment/[id]", params: { id } });
      }, 2000);
    },
    [cancelPending, moments, previewedId, reducedMotion, router, snapInterval],
  );

  const renderMoment = useCallback(
    ({ item, index }: CardRenderInfo) => (
      <RenderMoment
        index={index}
        item={item}
        itemWidth={itemWidth}
        openMoment={openMoment}
        onTiltActiveChange={setTiltActive}
        palette={palette}
        pendingId={pendingId}
        previewedId={previewedId}
        reducedMotion={reducedMotion}
        scrollX={scrollX}
        setPreviewedId={setPreviewedId}
        snapInterval={snapInterval}
      />
    ),
    [
      itemWidth,
      openMoment,
      palette,
      pendingId,
      previewedId,
      reducedMotion,
      scrollX,
      snapInterval,
    ],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: snapInterval,
      offset: snapInterval * index,
      index,
    }),
    [snapInterval],
  );

  const keyExtractor = useCallback((moment: ZimMoment) => moment.id, []);

  const onScroll = useMemo(() => {
    if (reducedMotion) {
      return undefined;
    }

    return Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      {
        useNativeDriver: true,
      },
    );
  }, [reducedMotion, scrollX]);

  const handleScrollBegin = useCallback(() => setIsUserScrolling(true), []);
  const handleScrollEnd = useCallback(() => setIsUserScrolling(false), []);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollEnd();
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / snapInterval,
      );
      const nextMoment =
        moments[Math.max(0, Math.min(nextIndex, moments.length - 1))];

      if (nextMoment) {
        setPreviewedId(nextMoment.id);
        if (pendingId && pendingId !== nextMoment.id) {
          cancelPending();
        }
      }
    },
    [cancelPending, handleScrollEnd, moments, pendingId, snapInterval],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[
          "rgba(45, 60, 140, 0.5)",
          "rgba(45, 60, 140, 0.1)",
          "transparent",
        ]}
        locations={[0, 0.5, 1]}
        style={styles.blueGlow}
      />
      <LinearGradient
        colors={[
          "rgba(185, 28, 46, 0.5)",
          "rgba(185, 28, 46, 0.1)",
          "transparent",
        ]}
        locations={[0, 0.5, 1]}
        style={styles.redGlow}
      />
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 18),
            paddingTop: insets.top + (isLandscape ? 18 : 34),
          },
        ]}
      >
        <View style={styles.heading}>
          <Text selectable style={[styles.title, { color: palette.text }]}>
            {section.title}
          </Text>
          <Text
            selectable
            style={[styles.description, { color: palette.mutedText }]}
          >
            {section.description}
          </Text>
        </View>

        <AnimatedMomentList
          contentContainerStyle={[
            styles.carousel,
            {
              paddingHorizontal: sidePadding,
              paddingBottom: bottomBuffer,
            },
          ]}
          data={moments}
          ref={listRef}
          decelerationRate="fast"
          horizontal
          getItemLayout={getItemLayout}
          initialNumToRender={3}
          keyExtractor={keyExtractor}
          maxToRenderPerBatch={3}
          onMomentumScrollBegin={handleScrollBegin}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScroll={onScroll}
          onScrollBeginDrag={handleScrollBegin}
          onScrollEndDrag={handleScrollEnd}
          removeClippedSubviews={Platform.OS !== "ios"}
          renderItem={renderMoment}
          scrollEnabled={!tiltActive}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={snapInterval}
          style={[styles.list, { height: listHeight }]}
          windowSize={3}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    gap: 18,
  },
  heading: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    maxWidth: 620,
    textAlign: "center",
  },
  list: {
    flexGrow: 0,
    marginTop: "auto",
    marginBottom: "auto",
  },
  carousel: {
    alignItems: "flex-start",
    gap: 22,
    paddingTop: 28,
  },
  blueGlow: {
    borderRadius: 9999,
    height: 360,
    left: "10%",
    position: "absolute",
    top: "-10%",
    width: 360,
  },
  redGlow: {
    borderRadius: 9999,
    bottom: "5%",
    height: 300,
    position: "absolute",
    right: "0%",
    width: 300,
  },
});
