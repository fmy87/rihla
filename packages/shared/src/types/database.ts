// Hand-authored types matching supabase/migrations/*.sql.
// Once the project is running, replace/augment this with output from:
//   supabase gen types typescript --project-id <id> > database.generated.ts
// Both apps (admin, driver-ios) import from this shared package so a schema
// change only needs to be reflected in one place.

export type UserRole = 'super_admin' | 'transport_admin' | 'driver';

export type BusStatus =
  | 'not_started' | 'preparing' | 'on_route' | 'delayed'
  | 'completed' | 'offline' | 'emergency';

export type RouteDirection = 'home_to_school' | 'school_to_home';

export type StopEventType = 'pickup' | 'dropoff';

export type ConfirmationStatus =
  | 'pending' | 'picked_up' | 'dropped_off' | 'absent'
  | 'cancelled' | 'not_confirmed' | 'exception';

export type NotPickedUpReason =
  | 'student_absent' | 'parent_cancelled' | 'student_not_ready'
  | 'wrong_location' | 'other';

export type AlertType =
  | 'student_not_picked_up' | 'route_deviation' | 'bus_delayed'
  | 'bus_offline' | 'dropoff_not_confirmed' | 'route_not_started' | 'stop_skipped';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type DailyRouteStatus = 'not_started' | 'on_route' | 'delayed' | 'completed' | 'cancelled';

export interface School {
  id: string;
  name_en: string;
  name_ar: string | null;
  logo_url: string | null;
  timezone: string;
  default_language: 'en' | 'ar';
  primary_accent_color: string | null;
  is_active: boolean;
}

export interface Bus {
  id: string;
  school_id: string;
  bus_number: string;
  registration_number: string;
  nickname_en: string | null;
  nickname_ar: string | null;
  capacity: number;
  default_driver_id: string | null;
  assistant_name: string | null;
  status: BusStatus;
  is_active: boolean;
  notes: string | null;
}

export interface Driver {
  id: string;
  school_id: string;
  user_id: string | null;
  employee_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  license_number: string | null;
  license_expiry: string | null;
  is_active: boolean;
}

export interface Student {
  id: string;
  school_id: string;
  student_code: string;
  name_en: string;
  name_ar: string | null;
  grade: string | null;
  class_name: string | null;
  gender: 'male' | 'female' | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_active: boolean;
}

export interface RouteRecord {
  id: string;
  school_id: string;
  name_en: string;
  name_ar: string | null;
  direction: RouteDirection;
  default_bus_id: string | null;
  default_driver_id: string | null;
  is_active: boolean;
}

export interface RouteStop {
  id: string;
  route_id: string;
  sequence: number;
  name_en: string;
  name_ar: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  estimated_arrival_time: string | null;
  stop_type: StopEventType;
  geofence_radius_meters: number | null;
  notes: string | null;
}

export interface DailyRoute {
  id: string;
  school_id: string;
  route_id: string;
  service_date: string; // YYYY-MM-DD
  bus_id: string;
  driver_id: string;
  status: DailyRouteStatus;
  started_at: string | null;
  completed_at: string | null;
  is_override: boolean;
}

export interface DailyRouteStop {
  id: string;
  daily_route_id: string;
  route_stop_id: string | null;
  sequence: number;
  name_en: string;
  name_ar: string | null;
  latitude: number;
  longitude: number;
  estimated_arrival_time: string | null;
  stop_type: StopEventType;
  is_skipped: boolean;
  arrived_at: string | null;
}

export interface DailyStudentAssignment {
  id: string;
  daily_route_stop_id: string;
  student_id: string;
  status: ConfirmationStatus;
  not_confirmed_reason: NotPickedUpReason | null;
  notes: string | null;
}

export interface GpsLocation {
  id: string;
  daily_route_id: string;
  bus_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  accuracy_meters: number | null;
  recorded_at: string;
}

export interface Alert {
  id: string;
  school_id: string;
  type: AlertType;
  severity: AlertSeverity;
  daily_route_id: string | null;
  bus_id: string | null;
  student_id: string | null;
  message_en: string;
  message_ar: string | null;
  deviation_distance_meters: number | null;
  is_resolved: boolean;
}
