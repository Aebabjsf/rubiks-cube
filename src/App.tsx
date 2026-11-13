import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, HashRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useThemeStore } from './store';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Tutorial = lazy(() => import('./pages/Tutorial').then(module => ({ default: module.Tutorial })));
const Simulation = lazy(() => import('./pages/Simulation').then(module => ({ default: module.Simulation })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const OnlineDuel = lazy(() => import('./pages/OnlineDuel').then(module => ({ default: module.OnlineDuel })));

function App() {
  const isDark = useThemeStore(state => state.isDark);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <HashRouter>
      {/* Dynamic Background Orbs */}
      <div className="bg-orb bg-orb-1 w-[60vw] h-[60vw] top-[-20%] left-[-10%]" style={{ animationDelay: '0s' }}></div>
      <div className="bg-orb bg-orb-2 w-[50vw] h-[50vw] bottom-[-10%] right-[-10%]" style={{ animationDelay: '-5s' }}></div>
      <div className="bg-orb bg-orb-3 w-[40vw] h-[40vw] top-[30%] left-[30%]" style={{ animationDelay: '-10s' }}></div>

      <GlobalErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500"></div></div>}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="tutorial" element={<Tutorial />} />
              <Route path="simulation" element={<Simulation />} />
              <Route path="profile" element={<Profile />} />
              <Route path="online" element={<OnlineDuel />} />
            </Route>
          </Routes>
        </Suspense>
      </GlobalErrorBoundary>
    </HashRouter>
  );
}

export default App;
