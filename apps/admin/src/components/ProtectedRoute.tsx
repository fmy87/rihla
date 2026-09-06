import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Omit to allow any authenticated admin-web role (super_admin, transport_admin). */
  allowRoles?: UserRole[];
}

/**
 * Drivers should never reach the admin web app in practice (their app is the
 * iPad build), but this guard still enforces it defensively: only
 * super_admin/transport_admin sessions are allowed past the login screen here.
 */
export function ProtectedRoute({ children, allowRoles = ['super_admin', 'transport_admin'] }: ProtectedRouteProps) {
  const { status, profile } = useAuth();

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  if (status === 'inactive') {
    return (
      <div className="flex h-screen items-center justify-center text-center">
        <p className="text-slate-600">Your account has been deactivated. Contact your administrator.</p>
      </div>
    );
  }

  if (status !== 'signed_in' || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
