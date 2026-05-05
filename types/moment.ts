export type MomentMediaKind = 'poster' | 'video';

export type ZimMoment = {
  id: string;
  title: string;
  location: string;
  caption: string;
  thumbnailUrl: string;
  videoUrl?: string;
  sourceUrl?: string;
  sourceLabel: string;
  mediaKind: MomentMediaKind;
  rating?: number;
  createdAt: string;
};

export type ZimMomentsSection = {
  eyebrow: string;
  title: string;
  description: string;
  totalMomentsLabel: string;
  centerCountLabel: string;
};
