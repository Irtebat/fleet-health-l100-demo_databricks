import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from 'react-router';
import { Moon, MessageSquare, Sun, Truck, Wrench, type LucideIcon } from 'lucide-react';
import { AssistantPage } from './pages/AssistantPage';
import { FleetPage } from './pages/FleetPage';
import { TicketsPage } from './pages/TicketsPage';
import { cx } from './lib/ui';

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/tickets', label: 'Service tickets', icon: Wrench },
  { to: '/assistant', label: 'Assistant', icon: MessageSquare },
];

const THEME_KEY = 'fleet-theme';

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

function Layout() {
  const theme = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <aside className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card px-4 py-3 md:w-60 md:flex-col md:items-stretch md:gap-6 md:border-b-0 md:border-r md:px-4 md:py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Truck className="h-4 w-4" aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Fleet Service</div>
            <div className="text-xs text-muted-foreground">Health &amp; tickets</div>
          </div>
        </div>

        <nav aria-label="Main" className="flex gap-1 md:flex-col">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" aria-hidden />
                  )}
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={theme.toggle}
          className="mt-auto flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:mt-auto"
        >
          {theme.dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          {theme.dark ? 'Light mode' : 'Dark mode'}
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-[1200px] space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/fleet" replace /> },
      { path: 'fleet', element: <FleetPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: '*', element: <Navigate to="/fleet" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
