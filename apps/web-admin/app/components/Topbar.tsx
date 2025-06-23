import { auth } from '@/lib/auth';
import { getVersionBadge } from '@/lib/version';
import TopbarClient from './TopbarClient';

export async function Topbar() {
  const version = await getVersionBadge();
  const session = await auth();
  
  // TODO: Replace with actual user session data
  const user = session?.user || {
    name: 'Koru',
    email: 'koru@vialabs.com',
    avatar: `https://ui-avatars.com/api/?name=Koru&background=random`,
  };

  return (
    <TopbarClient version={version} user={user} />
  );
}
