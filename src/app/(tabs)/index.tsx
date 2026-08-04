import { router } from 'expo-router';

import { HomeScreen } from '@/features/marcaje/home-screen';

/** Inicio — the marcaje screen. The route wires navigation and nothing else. */
export default function InicioTab() {
  return <HomeScreen onOpenProfile={() => router.push('/perfil')} />;
}
