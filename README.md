# ZIM Moments

React Native/Expo technical test project replicating the "6650 khoảnh khắc đáng nhớ" section from the ZIM homepage.

This app features a horizontal story carousel, custom `Animated` swipe/tilt/parallax interactions, and a fullscreen vertical video reel built specifically for mobile.

## Reviewer Guide

### Local Setup
```bash
npm install
npm start
```
Press `i` to open the iOS Simulator or `a` for the Android Emulator.
You can also scan the QR code with the Expo Go app on a physical device.

### Build Instructions

**Android APK**
To generate an installable APK for Android devices:
```bash
npx eas build -p android --profile preview --local
```
*(Requires Java/Android SDK installed locally. Drop the `--local` flag to build on Expo's cloud if you have an EAS account).*

**iOS**
Expo Go is recommended for testing on iOS. If you need a standalone iOS build (requires an Apple Developer account):
```bash
npx eas build -p ios
```

## Technical Decisions & Reasoning

**1. Stack Choice (Expo & React Native)**
I used Expo SDK 54 to get native mobile functionality quickly. Expo's modern first-party modules (`expo-video`, `expo-image`) provide reliable caching, hardware acceleration, and native performance out of the box, which is essential for heavy media feeds.

**2. Data Mocking Strategy**
The dataset is scraped from zim.vn and hardcoded locally. This guarantees the demo works offline and doesn't break due to network issues or API changes during the review process. 

**3. Performance Optimization**
- **Lists:** Used `FlatList` instead of mapping standard views. It keeps the render tree light by only mounting a small window of visible cards and lazy-loading offscreen items.
- **Images:** `expo-image` handles disk/memory caching, key recycling, and aggressive downscaling.
- **Video Memory:** Only the actively focused video is initialized and played to avoid concurrent decoding overhead.

**4. Animations & Gesture Handling**
- Built with React Native's core `Animated` API using the native driver. I restricted animated styles strictly to `transform` and `opacity` to keep layout calculations off the JS thread.
- For interaction conflicts (e.g., trying to scroll the carousel while the card tilt gesture is active), I implemented custom gesture handling. The tilt effect is gated behind a 180ms delay, and dragging horizontally correctly yields to the scroll view.

**5. Accessibility & UX Adjustments**
- **Reduced Motion:** The app checks the OS `prefers-reduced-motion` setting. If enabled, it strips out the heavy 3D tilt and parallax effects.
- **Orientation:** Handles both portrait and landscape layouts dynamically. Layout math adapts to prevent notches and navigation bars from clipping content.
