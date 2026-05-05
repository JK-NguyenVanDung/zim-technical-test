import { zimMoments, zimMomentsSection } from '@/data/ZimMoments';
import { MomentsHome } from '@/components/moments/MomentsHome';

export default function HomeRoute() {
  return <MomentsHome moments={zimMoments} section={zimMomentsSection} />;
}
