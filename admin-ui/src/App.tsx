import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { useAuth } from './hooks/useAuth';

// ── Lazy-load pages ────────────────────────────────────────────────────────────
const Login      = lazy(() => import('./pages/Login'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Scans      = lazy(() => import('./pages/Scans'));
const ScanDetail = lazy(() => import('./pages/ScanDetail'));
const Projects   = lazy(() => import('./pages/Projects'));
const AuditLog   = lazy(() => import('./pages/AuditLog'));
const Users      = lazy(() => import('./pages/Users'));
const ArmorIQ    = lazy(() => import('./pages/ArmorIQ'));

// ── Protected route guard ──────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFC] text-slate-450">
        <span className="text-2xl animate-spin">🛡️</span>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// ── RootLayout incorporating Sidebar & Outlet ────────────────────────────────
function RootLayout() {
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto pt-16 md:pt-0">
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen text-gray-500">
            <div className="text-center">
              <span className="text-2xl animate-pulse">🛡️</span>
              <p className="text-xs opacity-50 mt-2">Loading panel...</p>
            </div>
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// ── Router definition ─────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-[#040811] text-gray-500">
          <span className="text-2xl animate-pulse">🛡️</span>
        </div>
      }>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'scans',      element: <Scans /> },
      { path: 'scans/:id',  element: <ScanDetail /> },
      { path: 'projects',   element: <Projects /> },
      { path: 'audit-log',  element: <AuditLog /> },
      { path: 'users',      element: <Users /> },
      { path: 'armoriq',    element: <ArmorIQ /> },
      { path: '',           element: <Navigate to="/dashboard" replace /> },
      { path: '*',          element: <Navigate to="/dashboard" replace /> }
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
