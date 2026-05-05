import type { ColorSchemeName } from 'react-native';

export type MomentPalette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  mutedText: string;
  tint: string;
  tintSoft: string;
  border: string;
  overlay: string;
  overlayText: string;
};

export function getMomentPalette(colorScheme: ColorSchemeName): MomentPalette {
  if (colorScheme === 'dark') {
    return {
      background: '#1F1F1F',
      surface: '#262626',
      surfaceRaised: '#333333',
      text: '#FFFFFF',
      mutedText: '#D6D6D6',
      tint: '#B91C2E',
      tintSoft: 'rgba(185, 28, 46, 0.22)',
      border: 'rgba(255, 255, 255, 0.72)',
      overlay: 'rgba(0, 0, 0, 0.62)',
      overlayText: '#FFFFFF',
    };
  }

  return {
    background: '#1F1F1F',
    surface: '#262626',
    surfaceRaised: '#333333',
    text: '#FFFFFF',
    mutedText: '#E7E7E7',
    tint: '#B91C2E',
    tintSoft: 'rgba(185, 28, 46, 0.22)',
    border: 'rgba(255, 255, 255, 0.72)',
    overlay: 'rgba(0, 0, 0, 0.62)',
    overlayText: '#FFFFFF',
  };
}
