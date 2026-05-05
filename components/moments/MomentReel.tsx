import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type ViewStyle,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMomentPalette } from '@/components/moments/MomentPalette';
import type { MomentPalette } from '@/components/moments/MomentPalette';
import {
  getCachedVideoPlayer,
  silenceCachedVideoPlayers,
} from '@/components/moments/VideoCache';
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

type ReelIconName = React.ComponentProps<typeof Ionicons>['name'];
type WebFocusStyle = ViewStyle & {
  outlineColor?: string;
  outlineStyle?: 'solid';
  outlineWidth?: number;
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
  const [isDismissing, setIsDismissing] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayScale = useRef(new Animated.Value(1)).current;
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoUrlsRef = useRef<string[]>([]);
  const palette = useMemo(() => getMomentPalette(colorScheme), [colorScheme]);
  const activeMoment = moments[activeIndex] ?? moments[0];
  const hasVideo = Boolean(activeMoment?.videoUrl);
  const activePlayer = useMemo(
    () => (activeMoment?.videoUrl ? getCachedVideoPlayer(activeMoment.videoUrl) : null),
    [activeMoment?.videoUrl]
  );

  useEffect(() => {
    videoUrlsRef.current = moments
      .map((moment) => moment.videoUrl)
      .filter((uri): uri is string => Boolean(uri));
  }, [moments]);

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

  const captionExpandedRef = useRef(captionExpanded);
  captionExpandedRef.current = captionExpanded;

  const togglePlayback = useCallback(() => {
    if (captionExpandedRef.current) {
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
  }, [flashOverlay]);

  useEffect(() => {
    flashOverlay(true);
  }, [flashOverlay]);

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
          isMuted={active ? isMuted : true}
          moment={item}
          onTogglePlayback={togglePlayback}
          onToggleCaption={toggleCaptionExpanded}
          palette={palette}
          shouldPlay={active && shouldPlay}
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

  const silenceReelPlayers = useCallback(() => {
    silenceCachedVideoPlayers(videoUrlsRef.current);
  }, []);

  const close = useCallback(() => {
    setIsDismissing(true);
    setShouldPlay(false);
    silenceReelPlayers();
    router.back();
  }, [silenceReelPlayers, router]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => !current);
  }, []);

  const headerHeight = insets.top + 12 + 44;

  useFocusEffect(
    useCallback(() => {
      return () => {
        silenceReelPlayers();
      };
    }, [silenceReelPlayers])
  );

  useEffect(() => silenceReelPlayers, [silenceReelPlayers]);

  if (isDismissing) {
    return <View style={[styles.reel, { backgroundColor: '#000000' }]} />;
  }

  return (
    <View style={[styles.reel, { backgroundColor: '#000000' }]}>
      <FlatList
        data={moments}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        initialScrollIndex={initialIndex}
        keyExtractor={keyExtractor}
        maxToRenderPerBatch={1}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        pagingEnabled
        ref={listRef}
        removeClippedSubviews={false}
        renderItem={renderSlide}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={height}
        style={styles.reel}
        updateCellsBatchingPeriod={50}
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
          <ReelIcon
            color={palette.overlayText}
            name={shouldPlay ? 'pause' : 'play'}
            size={44}
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
              <ReelIcon color={palette.overlayText} name="image" size={20} />
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
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="cover"
          priority={isActive ? 'high' : 'normal'}
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
  const [isFocused, setIsFocused] = useState(false);
  const webFocusStyle: WebFocusStyle | undefined =
    isFocused && Platform.OS === 'web'
      ? {
          outlineColor: palette.overlayText,
          outlineStyle: 'solid',
          outlineWidth: 3,
        }
      : undefined;

  return (
    <View style={[styles.captionWrap, expanded && styles.captionWrapExpanded]}>
      <BottomFade />
      <Pressable
        accessibilityHint={expanded ? 'Chạm để thu gọn và phát video' : 'Chạm để xem thêm'}
        accessibilityRole="button"
        onBlur={() => setIsFocused(false)}
        onFocus={() => setIsFocused(true)}
        onPress={onToggle}
        style={[
          styles.captionInner,
          isFocused && { borderColor: palette.overlayText },
          webFocusStyle,
        ]}>
        <Text
          style={[styles.slideTitle, { color: palette.overlayText }]}
          numberOfLines={2}>
          {title}
        </Text>
        <Text
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
      useNativeDriver: true,
    }).start();
  }, [currentTime, player, progress]);

  return (
    <View pointerEvents="none" style={[styles.progressTrack, { top }]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            transform: [{ scaleX: progress }],
          },
        ]}
      />
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
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const playIfReady = useCallback(() => {
    if (!isActive || !shouldPlay) return;
    if (player.status !== 'readyToPlay') return;
    player.play();
  }, [isActive, player, shouldPlay]);

  useEffect(() => {
    if (!isActive) return;
    player.muted = isMuted;
  }, [isActive, isMuted, player]);

  useEffect(() => {
    if (!isActive || !shouldPlay) return;
    if (isPlaying) return;
    if (player.status !== 'readyToPlay') return;
    player.play();
  }, [isActive, isMuted, isPlaying, player, shouldPlay, status]);

  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      try {
        player.currentTime = 0;
      } catch (e) {
        // Ignore seek errors on unready players
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive, player]);

  useEffect(() => {
    if (!isActive || !shouldPlay) {
      player.pause();
      return;
    }

    playIfReady();
    const frameId = requestAnimationFrame(playIfReady);
    const timeoutId = setTimeout(playIfReady, 120);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [isActive, playIfReady, player, shouldPlay, status]);

  return (
    <View style={styles.media}>
      <VideoView
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        onFirstFrameRender={playIfReady}
        player={player}
        style={styles.media}
      />
      {!isPlaying ? (
        <Image
          accessibilityIgnoresInvertColors
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="cover"
          priority={isActive ? 'high' : 'normal'}
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
  icon: ReelIconName;
  iconSize: number;
  onPress: () => void;
  palette: MomentPalette;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const webFocusStyle: WebFocusStyle | undefined =
    isFocused && Platform.OS === 'web'
      ? {
          outlineColor: palette.overlayText,
          outlineStyle: 'solid',
          outlineWidth: 3,
        }
      : undefined;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={(e) => {
        if (e?.stopPropagation) e.stopPropagation();
        onPress();
      }}
      style={[
        styles.iconButton,
        {
          backgroundColor: palette.overlay,
          borderColor: isFocused ? palette.overlayText : 'rgba(255,255,255,0.28)',
        },
        webFocusStyle,
      ]}>
      <ReelIcon color={palette.overlayText} name={icon} size={iconSize} />
    </Pressable>
  );
}

function ReelIcon({
  color,
  name,
  size,
}: {
  color: string;
  name: ReelIconName;
  size: number;
}) {
  return (
    <Ionicons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
    />
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
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 2,
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
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 2,
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
    transformOrigin: 'left center',
    width: '100%',
  },
});
