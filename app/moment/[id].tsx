import { useLocalSearchParams } from 'expo-router';

import { MomentReel } from '@/components/moments/MomentReel';
import { getMomentIndexById, zimMoments } from '@/data/ZimMoments';

export default function MomentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initialIndex = getMomentIndexById(id);

  return <MomentReel initialIndex={initialIndex} moments={zimMoments} />;
}
