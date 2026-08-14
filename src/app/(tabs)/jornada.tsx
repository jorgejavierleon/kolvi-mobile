import { router } from 'expo-router';

import { JornadaScreen } from '@/features/jornada/jornada-screen';

/** Jornada — the route wires navigation and nothing else. */
export default function JornadaTab() {
  return <JornadaScreen onOpenProfile={() => router.push('/perfil')} />;
}
