import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentCard } from '@/components/moments/MomentCard';
import { getMomentPalette } from '@/components/moments/MomentPalette';
import { getCachedVideoPlayer, pauseCachedVideoPlayer } from '@/components/moments/VideoCache';
import { useReducedMotionPreference } from '@/hooks/UseReducedMotionPreference';
import type { ZimMoment, ZimMomentsSection } from '@/types/moment';

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
  palette: ReturnType<typeof getMomentPalette>;
  pendingId: string | undefined;
  previewedId: string | undefined;
  reducedMotion: boolean;
  scrollX: Animated.Value;
  setPreviewedId: (id: string) => void;
  snapInterval: number;
};

const RenderMoment = memo(
  ({
    index,
    item,
    itemWidth,
    openMoment,
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
      palette={palette}
      reducedMotion={reducedMotion}
      scrollX={scrollX}
      snapInterval={snapInterval}
    />
  )
);
RenderMoment.displayName = 'RenderMoment';

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
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    [moments, previewedId]
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
  const itemWidth = Math.min(isLandscape ? 260 : 290, Math.max(172, width * 0.58));
  const snapInterval = itemWidth + 22;
  const sidePadding = Math.max(18, (width - itemWidth) / 2);

  const openMoment = useCallback(
    (id: string) => {
      if (previewedId === id) {
        cancelPending();
        router.push({ pathname: '/moment/[id]', params: { id } });
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
        router.push({ pathname: '/moment/[id]', params: { id } });
      }, 2000);
    },
    [cancelPending, moments, previewedId, reducedMotion, router, snapInterval]
  );

  const renderMoment = useCallback(
    ({ item, index }: CardRenderInfo) => (
      <RenderMoment
        index={index}
        item={item}
        itemWidth={itemWidth}
        openMoment={openMoment}
        palette={palette}
        pendingId={pendingId}
        previewedId={previewedId}
        reducedMotion={reducedMotion}
        scrollX={scrollX}
        setPreviewedId={setPreviewedId as any}
        snapInterval={snapInterval}
      />
    ),
    [itemWidth, openMoment, palette, pendingId, previewedId, reducedMotion, scrollX, snapInterval]
  );

  const keyExtractor = useCallback((moment: ZimMoment) => moment.id, []);

  const onScroll = useMemo(() => {
    if (reducedMotion) {
      return undefined;
    }

    return Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
    });
  }, [reducedMotion, scrollX]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
      const nextMoment = moments[Math.max(0, Math.min(nextIndex, moments.length - 1))];

      if (nextMoment) {
        setPreviewedId(nextMoment.id);
        if (pendingId && pendingId !== nextMoment.id) {
          cancelPending();
        }
      }
    },
    [cancelPending, moments, pendingId, snapInterval]
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.blueGlow} />
      <View style={styles.redGlow} />
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 18),
            paddingTop: insets.top + (isLandscape ? 18 : 34),
          },
        ]}>
        <View style={styles.heading}>
          <Text selectable style={[styles.title, { color: palette.text }]}>
            {section.title}
          </Text>
          <Text selectable style={[styles.description, { color: palette.mutedText }]}>
            {section.description}
          </Text>
        </View>

        <Animated.FlatList
          contentContainerStyle={[
            styles.carousel,
            {
              paddingHorizontal: sidePadding,
            },
          ]}
          data={moments}
          ref={listRef as never}
          decelerationRate="fast"
          horizontal
          initialNumToRender={6}
          keyExtractor={keyExtractor}
          maxToRenderPerBatch={4}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScroll={onScroll}
          removeClippedSubviews
          renderItem={renderMoment}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={snapInterval}
          style={styles.list}
          windowSize={5}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    gap: 18,
  },
  heading: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    maxWidth: 620,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  carousel: {
    alignItems: 'center',
    gap: 22,
  },
  blueGlow: {
    backgroundColor: 'rgba(45, 60, 140, 0.5)',
    borderRadius: 999,
    height: 360,
    left: '18%',
    opacity: 0.55,
    position: 'absolute',
    top: -70,
    transform: [{ scaleX: 0.45 }],
    width: 360,
  },
  redGlow: {
    backgroundColor: 'rgba(185, 28, 46, 0.36)',
    borderRadius: 999,
    bottom: 80,
    height: 300,
    opacity: 0.7,
    position: 'absolute',
    right: '10%',
    transform: [{ scaleX: 0.55 }],
    width: 300,
  },
});
