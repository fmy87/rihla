import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import LiveTrackingPage from './pages/LiveTracking';
import BusesPage from './pages/Buses';
import DriversPage from './pages/Drivers';
import StudentsPage from './pages/Students';
import UsersPage from './pages/Users';
import RoutesPage from './pages/Routes';
import RouteEditorPage from './pages/RouteEditor';
import DailyOperationsPage from './pages/DailyOperations';
import RouteReplayPage from './pages/RouteReplay';
import AttendancePage from './pages/Attendance';
import AlertsPage from './pages/Alerts';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import StopsPage from './pages/Stops';
import './lib/i18n';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Screens below are intentionally placeholders — clearly labeled by the
              phase that builds them, per the "no fake functionality" requirement. */}
          <Route
            path="/live-tracking"
            element={
              <ProtectedRoute>
                <LiveTrackingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes"
            element={
              <ProtectedRoute>
                <RoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes/:routeId"
            element={
              <ProtectedRoute>
                <RouteEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/buses"
            element={
              <ProtectedRoute>
                <BusesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drivers"
            element={
              <ProtectedRoute>
                <DriversPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stops"
            element={
              <ProtectedRoute>
                <StopsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-operations"
            element={
              <ProtectedRoute>
                <DailyOperationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-operations/:dailyRouteId/replay"
            element={
              <ProtectedRoute>
                <RouteReplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowRoles={['super_admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowRoles={['super_admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
