import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { VideoView, type VideoPlayer } from 'expo-video';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMomentPalette } from '@/components/moments/MomentPalette';
import type { MomentPalette } from '@/components/moments/MomentPalette';
import { getCachedVideoPlayer } from '@/components/moments/VideoCache';
import { useReducedMotionPreference } from '@/hooks/UseReducedMotionPreference';
import type { ZimMoment } from '@/types/moment';

type MomentReelProps = {
  initialIndex: number;
  moments: ZimMoment[];
};

type ReelSlideProps = {
  height: number;
  isActive: boolean;
  isMuted: boolean;
  moment: ZimMoment;
  onTogglePlayback: () => void;
  palette: MomentPalette;
  shouldPlay: boolean;
};

const AUTO_FADE_MS = 900;

export function MomentReel({ initialIndex, moments }: MomentReelProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const listRef = useRef<FlatList<ZimMoment>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [shouldPlay, setShouldPlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayScale = useRef(new Animated.Value(1)).current;
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palette = useMemo(() => getMomentPalette(colorScheme), [colorScheme]);
  const activeMoment = moments[activeIndex] ?? moments[0];
  const hasVideo = Boolean(activeMoment?.videoUrl);
  const activePlayer = useMemo(
    () => (activeMoment?.videoUrl ? getCachedVideoPlayer(activeMoment.videoUrl) : null),
    [activeMoment?.videoUrl]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const nextIndex = viewableItems[0]?.index;

      if (typeof nextIndex === 'number') {
        setActiveIndex(nextIndex);
      }
    }
  ).current;

  const getItemLayout = useCallback(
    (_: ArrayLike<ZimMoment> | null | undefined, index: number) => ({
      index,
      length: height,
      offset: height * index,
    }),
    [height]
  );

  const flashOverlay = useCallback(
    (autoFade: boolean) => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }

      if (reducedMotion) {
        overlayOpacity.setValue(autoFade ? 0 : 1);
        overlayScale.setValue(1);
        return;
      }

      overlayScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          duration: 140,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(overlayScale, {
          friction: 6,
          tension: 140,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!autoFade) return;
        fadeTimeoutRef.current = setTimeout(() => {
          Animated.timing(overlayOpacity, {
            duration: 260,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }, AUTO_FADE_MS);
      });
    },
    [overlayOpacity, overlayScale, reducedMotion]
  );

  const togglePlayback = useCallback(() => {
    setShouldPlay((current) => {
      const next = !current;
      flashOverlay(next);
      return next;
    });
  }, [flashOverlay]);

  useEffect(() => {
    if (shouldPlay) {
      flashOverlay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const renderSlide = useCallback(
    ({ item, index }: ListRenderItemInfo<ZimMoment>) => (
      <MomentReelSlide
        height={height}
        isActive={index === activeIndex}
        isMuted={isMuted}
        moment={item}
        onTogglePlayback={togglePlayback}
        palette={palette}
        shouldPlay={shouldPlay}
      />
    ),
    [activeIndex, height, isMuted, palette, shouldPlay, togglePlayback]
  );

  const onScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      const fallbackIndex = Math.min(index, moments.length - 1);

      setTimeout(() => {
        listRef.current?.scrollToIndex({ animated: false, index: fallbackIndex });
      }, 80);
    },
    [moments.length]
  );

  const close = useCallback(() => {
    router.back();
  }, [router]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => !current);
  }, []);

  const headerHeight = insets.top + 12 + 44;

  return (
    <View style={[styles.reel, { backgroundColor: '#000000' }]}>
      <FlatList
        data={moments}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        initialScrollIndex={initialIndex}
        keyExtractor={keyExtractor}
        maxToRenderPerBatch={2}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        pagingEnabled
        ref={listRef}
        removeClippedSubviews
        renderItem={renderSlide}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={height}
        style={styles.reel}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
      />

      {hasVideo ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centerOverlay,
            {
              backgroundColor: palette.overlay,
              opacity: overlayOpacity,
              transform: [{ scale: overlayScale }],
            },
          ]}>
          <Ionicons
            color={palette.overlayText}
            name={shouldPlay ? 'pause' : 'play'}
            size={44}
            style={shouldPlay ? undefined : styles.playIconNudge}
          />
        </Animated.View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.topBar,
          {
            paddingLeft: Math.max(16, width * 0.04),
            paddingRight: Math.max(16, width * 0.04),
            paddingTop: insets.top + 12,
          },
        ]}>
        <IconButton
          accessibilityLabel="Đóng"
          icon="close"
          iconSize={26}
          onPress={close}
          palette={palette}
        />
        <View style={styles.brandMark} pointerEvents="none">
          <Ionicons color="#FFFFFF" name="book" size={22} />
        </View>
        <View style={styles.topActions}>
          {hasVideo ? (
            <IconButton
              accessibilityLabel={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
              icon={isMuted ? 'volume-mute' : 'volume-high'}
              iconSize={22}
              onPress={toggleMute}
              palette={palette}
            />
          ) : (
            <View style={[styles.posterOnly, { backgroundColor: palette.overlay }]}>
              <Ionicons color={palette.overlayText} name="image" size={20} />
            </View>
          )}
        </View>
      </View>

      {activePlayer ? (
        <VideoProgressBar
          key={activeMoment?.id}
          player={activePlayer}
          top={headerHeight + 6}
        />
      ) : null}
    </View>
  );
}

const MomentReelSlide = memo(function MomentReelSlide({
  height,
  isActive,
  isMuted,
  moment,
  onTogglePlayback,
  palette,
  shouldPlay,
}: ReelSlideProps) {
  const hasVideo = Boolean(moment.videoUrl);

  return (
    <View style={[styles.slide, { height }]}>
      {moment.videoUrl ? (
        <Pressable onPress={onTogglePlayback} style={styles.media}>
          <MomentVideo
            isActive={isActive}
            isMuted={isMuted}
            posterUrl={moment.thumbnailUrl}
            shouldPlay={shouldPlay}
            videoUrl={moment.videoUrl}
          />
        </Pressable>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={{ uri: moment.thumbnailUrl }}
          style={styles.media}
          transition={0}
        />
      )}

      <View pointerEvents="none" style={styles.scrim} />

      <ExpandableCaption
        caption={moment.caption}
        kicker={hasVideo ? 'Video khoảnh khắc' : 'Khoảnh khắc dạng ảnh'}
        location={moment.location}
        palette={palette}
        title={moment.title}
      />
    </View>
  );
});

function ExpandableCaption({
  caption,
  kicker,
  location,
  palette,
  title,
}: {
  caption: string;
  kicker: string;
  location: string;
  palette: MomentPalette;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullText = `${location}\n${caption}`;

  if (expanded) {
    return (
      <View style={styles.captionExpandedWrap}>
        <ShadowStack />
        <Pressable
          accessibilityHint="Chạm để thu gọn"
          accessibilityRole="button"
          onPress={() => setExpanded(false)}
          style={styles.captionExpandedInner}>
          <Text selectable style={[styles.slideKicker, { color: palette.tint }]}>
            {kicker}
          </Text>
          <Text selectable style={[styles.slideTitle, { color: palette.overlayText }]}>
            {title}
          </Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.captionScroll}>
            <Text selectable style={[styles.slideLocation, { color: palette.overlayText }]}>
              {location}
            </Text>
            <Text selectable style={[styles.slideCaption, { color: palette.overlayText }]}>
              {caption}
            </Text>
            <Text style={styles.captionHint}>Chạm để thu gọn</Text>
          </ScrollView>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.captionCollapsedWrap}>
      <ShadowStack />
      <Pressable
        accessibilityHint="Chạm để mở rộng mô tả"
        accessibilityRole="button"
        onPress={() => setExpanded(true)}
        style={styles.captionCollapsedInner}>
        <Text selectable style={[styles.slideKicker, { color: palette.tint }]}>
          {kicker}
        </Text>
        <Text selectable style={[styles.slideTitle, { color: palette.overlayText }]} numberOfLines={2}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          selectable
          style={[styles.slideCaption, { color: palette.overlayText }]}>
          {fullText}
        </Text>
        <Text style={styles.captionHint}>Chạm để xem thêm</Text>
      </Pressable>
    </View>
  );
}

const SHADOW_LAYERS = 8;

function ShadowStack() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: SHADOW_LAYERS }).map((_, i) => {
        const t = i / (SHADOW_LAYERS - 1);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: `${(t + 0.15) * 100}%`,
              backgroundColor: `rgba(0,0,0,${0.08 + t * 0.12})`,
            }}
          />
        );
      })}
    </View>
  );
}

function VideoProgressBar({ player, top }: { player: VideoPlayer; top: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const lastRatioRef = useRef(0);

  useEffect(() => {
    try {
      player.timeUpdateEventInterval = 0.25;
    } catch {}
  }, [player]);

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: 0,
    bufferedPosition: 0,
  });

  useEffect(() => {
    const duration = player.duration || 0;
    if (!duration || !isFinite(duration)) return;
    const ratio = Math.max(0, Math.min(1, currentTime / duration));
    const wrapped = ratio < lastRatioRef.current - 0.05 ? 0 : ratio;
    lastRatioRef.current = ratio;
    Animated.timing(progress, {
      duration: 200,
      toValue: wrapped,
      useNativeDriver: false,
    }).start();
  }, [currentTime, player, progress]);

  const widthInterp = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View pointerEvents="none" style={[styles.progressTrack, { top }]}>
      <Animated.View style={[styles.progressFill, { width: widthInterp }]} />
    </View>
  );
}

function MomentVideo({
  isActive,
  isMuted,
  posterUrl,
  shouldPlay,
  videoUrl,
}: {
  isActive: boolean;
  isMuted: boolean;
  posterUrl: string;
  shouldPlay: boolean;
  videoUrl: string;
}) {
  const player = useMemo(() => getCachedVideoPlayer(videoUrl), [videoUrl]);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    player.muted = isMuted;

    if (isActive && shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isMuted, player, shouldPlay]);

  return (
    <View style={styles.media}>
      <VideoView
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={styles.media}
      />
      {!isPlaying ? (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={{ uri: posterUrl }}
          style={styles.videoPoster}
          transition={0}
        />
      ) : null}
    </View>
  );
}

function IconButton({
  accessibilityLabel,
  icon,
  iconSize,
  onPress,
  palette,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconSize: number;
  onPress: () => void;
  palette: MomentPalette;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: palette.overlay }]}>
      <Ionicons color={palette.overlayText} name={icon} size={iconSize} />
    </Pressable>
  );
}

function keyExtractor(moment: ZimMoment) {
  return moment.id;
}

const styles = StyleSheet.create({
  reel: {
    flex: 1,
  },
  slide: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  media: {
    height: '100%',
    width: '100%',
  },
  videoPoster: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  slideKicker: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
  },
  slideLocation: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    opacity: 0.95,
    marginBottom: 6,
  },
  slideCaption: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.94,
  },
  captionCollapsedWrap: {
    bottom: 0,
    left: 0,
    paddingTop: 60,
    position: 'absolute',
    right: 0,
  },
  captionCollapsedInner: {
    gap: 6,
    paddingBottom: 88,
    paddingHorizontal: 20,
  },
  captionExpandedWrap: {
    bottom: 0,
    left: 0,
    maxHeight: '70%',
    paddingTop: 80,
    position: 'absolute',
    right: 0,
  },
  captionExpandedInner: {
    gap: 8,
    paddingBottom: 88,
    paddingHorizontal: 20,
  },
  captionScroll: {
    maxHeight: 240,
  },
  captionHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    justifyContent: 'flex-end',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#B91C2E',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  posterOnly: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  centerOverlay: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    height: 88,
    justifyContent: 'center',
    position: 'absolute',
    top: '50%',
    marginTop: -44,
    width: 88,
  },
  playIconNudge: {
    marginLeft: 4,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    height: 3,
    left: 16,
    position: 'absolute',
    right: 16,
    borderRadius: 2,
    overflow: 'hidden',
    zIndex: 2,
  },
  progressFill: {
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
});
