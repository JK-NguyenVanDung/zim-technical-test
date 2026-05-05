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
  player.muted = false;
  player.audioMixingMode = 'auto';
  player.allowsExternalPlayback = false;
  player.showNowPlayingNotification = false;
  player.staysActiveInBackground = false;
  player.bufferOptions = {
    preferredForwardBufferDuration: 6,
    minBufferForPlayback: 1,
  };
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

export function pauseCachedVideoPlayers(uris: string[]) {
  for (const uri of new Set(uris)) {
    pauseCachedVideoPlayer(uri);
  }
}

