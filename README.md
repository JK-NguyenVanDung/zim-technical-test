# ZIM Moments Expo Go Demo

Expo technical-test project for the ZIM homepage section `6650 khoảnh khắc đáng nhớ`.

Current state: full Expo Go demo with a stack-only Vietnamese home screen, horizontal video discovery, native Animated hover/move effects, and a fullscreen reel modal.

## Stack

- Expo SDK 54
- React Native 0.81.5
- React 19.1.0
- Expo Router
- Expo Video
- Expo Screen Orientation
- TypeScript strict mode
- Expo Go target

## Setup

```bash
npm install
```

## Run

```bash
npm run start
```

Scan the QR code with Expo Go.

## Build

Expo Go is the primary demo path. For an APK handoff, log in to EAS and run:

```bash
npx eas build -p android --profile preview
```

The `preview` profile outputs an internal Android APK.

## Lint

```bash
npm run lint
npx tsc --noEmit
```

## What Is Implemented

- `types/moment.ts`: strict shared data contract for ZIM moments.
- `data/ZimMoments.ts`: curated static data crawled from `zim.vn`.
- `components/moments/`: home section, carousel card, fullscreen reel, and theme palette.
- `app/index.tsx`: ZIM moments home route.
- `app/moment/[id].tsx`: fullscreen modal reel route.
- `eas.json`: preview APK build profile for EAS.
- `tracking.md`: process notes for interview explanation and verification.

## Product Direction

The app recreates the ZIM homepage “Memorable Moments” section in a mobile Expo environment. It keeps the dark section, centered Vietnamese heading, horizontal story cards, video play affordance, and fullscreen reel behavior.

The data comes from the ZIM homepage stories GraphQL call used by the web section. Items include `thumbnailUrl` and playable `videoUrl` values from `social-media.zim.vn`, with `expo-video` handling fullscreen playback.

## Interview Notes

- Data is static by design so the demo works during interview without depending on ZIM API availability.
- Motion uses React Native `Animated` with native driver, transform, and opacity only.
- First tap/focus/hover previews the card; second tap opens the reel.
- Reduced-motion mode disables the stronger card movement.
- The app stays Expo Go only; no custom native build or development client is required.
