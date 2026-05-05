import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { getCachedVideoPlayer, resetCachedVideoPlayer } from '@/components/moments/VideoCache';
import { useReducedMotionPreference } from '@/hooks/UseReducedMotionPreference';
import type { ZimMoment } from '@/types/moment';

type MomentReelProps = {
  initialIndex: number;
  moments: ZimMoment[];
};

type ReelSlideProps = {
  captionExpanded: boolean;
  height: number;
  isActive: boolean;
  isMuted: boolean;
  moment: ZimMoment;
  onToggleCaption: () => void;
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
  const [captionExpanded, setCaptionExpanded] = useState(false);
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

  // Always start the video from the beginning when the reel opens or the
  // active slide changes, in case the player was pre-warmed from the carousel.
  useEffect(() => {
    if (activeMoment?.videoUrl) {
      resetCachedVideoPlayer(activeMoment.videoUrl);
    }
  }, [activeMoment?.videoUrl]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const nextIndex = viewableItems[0]?.index;

      if (typeof nextIndex === 'number') {
        setActiveIndex(nextIndex);
        setCaptionExpanded(false);
        setShouldPlay(true);
      }
    }
  ).current;

  const toggleCaptionExpanded = useCallback(() => {
    setCaptionExpanded((current) => {
      const next = !current;
      setShouldPlay(!next);
      return next;
    });
  }, []);

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
    if (captionExpanded) {
      setCaptionExpanded(false);
      setShouldPlay(true);
      flashOverlay(true);
      return;
    }
    setShouldPlay((current) => {
      const next = !current;
      flashOverlay(next);
      return next;
    });
  }, [captionExpanded, flashOverlay]);

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
    ({ item, index }: ListRenderItemInfo<ZimMoment>) => {
      const active = index === activeIndex;
      return (
        <MomentReelSlide
          captionExpanded={active && captionExpanded}
          height={height}
          isActive={active}
          isMuted={isMuted}
          moment={item}
          onTogglePlayback={togglePlayback}
          onToggleCaption={toggleCaptionExpanded}
          palette={palette}
          shouldPlay={shouldPlay}
        />
      );
    },
    [
      activeIndex,
      captionExpanded,
      height,
      isMuted,
      palette,
      shouldPlay,
      toggleCaptionExpanded,
      togglePlayback,
    ]
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
          top={headerHeight + 24}
        />
      ) : null}
    </View>
  );
}

const MomentReelSlide = memo(function MomentReelSlide({
  captionExpanded,
  height,
  isActive,
  isMuted,
  moment,
  onToggleCaption,
  onTogglePlayback,
  palette,
  shouldPlay,
}: ReelSlideProps) {
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

      {captionExpanded ? (
        <View pointerEvents="none" style={styles.expandedDim} />
      ) : null}

      <ExpandableCaption
        title={moment.title}
        caption={moment.caption}
        expanded={captionExpanded}
        location={moment.location}
        onToggle={onToggleCaption}
        palette={palette}
      />
    </View>
  );
});

function ExpandableCaption({
  title,
  caption,
  expanded,
  location,
  onToggle,
  palette,
}: {
  title: string;
  caption: string;
  expanded: boolean;
  location: string;
  onToggle: () => void;
  palette: MomentPalette;
}) {
  return (
    <View style={[styles.captionWrap, expanded && styles.captionWrapExpanded]}>
      <BottomFade />
      <Pressable
        accessibilityHint={expanded ? 'Chạm để thu gọn và phát video' : 'Chạm để xem thêm'}
        accessibilityRole="button"
        onPress={onToggle}
        style={styles.captionInner}>
        <Text
          selectable
          style={[styles.slideTitle, { color: palette.overlayText }]}
          numberOfLines={2}>
          {title}
        </Text>
        <Text
          selectable
          style={[styles.slideLocation, { color: palette.overlayText }]}
          numberOfLines={1}>
          {location}
        </Text>
        {expanded ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.captionScroll}>
            <Text selectable style={[styles.slideCaption, { color: palette.overlayText }]}>
              {caption}
            </Text>
          </ScrollView>
        ) : null}
      </Pressable>
    </View>
  );
}

function BottomFade() {
  return (
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
      locations={[0, 0.55, 1]}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
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
  expandedDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  slideKicker: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  slideLocation: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  slideCaption: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.94,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionWrap: {
    bottom: 0,
    left: 0,
    paddingTop: 36,
    position: 'absolute',
    right: 0,
  },
  captionWrapExpanded: {
    maxHeight: '55%',
    paddingTop: 60,
  },
  captionInner: {
    gap: 6,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  captionScroll: {
    maxHeight: 220,
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
