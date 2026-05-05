import { createVideoPlayer, type VideoPlayer } from 'expo-video';

const MAX_PLAYERS = 16;
const cache = new Map<string, VideoPlayer>();

export function getCachedVideoPlayer(uri: string): VideoPlayer {
  let player = cache.get(uri);

  if (player) {
    cache.delete(uri);
    cache.set(uri, player);
    return player;
  }

  player = createVideoPlayer({ uri });
  player.loop = true;
  player.muted = true;
  player.bufferOptions = {
    preferredForwardBufferDuration: 6,
    minBufferForPlayback: 1,
  };
  // Do NOT auto-play here — let each consumer drive playback so the
  // currentTime never advances before the reel opens.

  cache.set(uri, player);

  if (cache.size > MAX_PLAYERS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey && oldestKey !== uri) {
      const evicted = cache.get(oldestKey);
      cache.delete(oldestKey);
      try {
        evicted?.pause();
        evicted?.release();
      } catch {}
    }
  }

  return player;
}

export function pauseCachedVideoPlayer(uri: string) {
  const player = cache.get(uri);
  try {
    player?.pause();
  } catch {}
}

/**
 * Seek a cached player back to the start so that the next viewer always
 * begins at 0:00, regardless of how far playback advanced during pre-warming.
 */
export function resetCachedVideoPlayer(uri: string) {
  const player = cache.get(uri);
  try {
    if (player) player.currentTime = 0;
  } catch {}
}
