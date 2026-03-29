import { HomeView } from './components/HomeView';
import { useApiHealth } from './hooks/useApiHealth';
import { useAppSelector } from '@/store/hooks';

/** Container: reads global app state + feature data hooks, renders UI. */
export function HomePage() {
  const appName = useAppSelector((s) => s.app.appName);
  const health = useApiHealth();

  return <HomeView appName={appName} health={health} />;
}
