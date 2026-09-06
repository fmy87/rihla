import { supabase } from '../supabaseClient';

// NOTE: duplicated from packages/shared/src/types/database.ts until the repo
// is wired up as a proper npm/pnpm workspace with a build step for the
// shared package (tracked for Phase 12). Keep in sync manually until then.
export type BusStatus =
  | 'not_started' | 'preparing' | 'on_route' | 'delayed'
  | 'completed' | 'offline' | 'emergency';

export interface BusRow {
  id: string;
  bus_number: string;
  registration_number: string;
  nickname_en: string | null;
  nickname_ar: string | null;
  capacity: number;
  default_driver_id: string | null;
  driver_name: string | null;
  assistant_name: string | null;
  status: BusStatus;
  is_active: boolean;
  notes: string | null;
}

export interface BusInput {
  bus_number: string;
  registration_number: string;
  nickname_en?: string | null;
  nickname_ar?: string | null;
  capacity: number;
  default_driver_id?: string | null;
  assistant_name?: string | null;
  notes?: string | null;
}

export async function fetchBuses(schoolId: string): Promise<BusRow[]> {
  const { data, error } = await supabase
    .from('buses')
    .select('id, bus_number, registration_number, nickname_en, nickname_ar, capacity, default_driver_id, assistant_name, status, is_active, notes, drivers(full_name)')
    .eq('school_id', schoolId)
    .order('bus_number', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    bus_number: row.bus_number,
    registration_number: row.registration_number,
    nickname_en: row.nickname_en,
    nickname_ar: row.nickname_ar,
    capacity: row.capacity,
    default_driver_id: row.default_driver_id,
    // @ts-expect-error -- joined field, typed properly once `supabase gen types` runs
    driver_name: row.drivers?.full_name ?? null,
    assistant_name: row.assistant_name,
    status: row.status,
    is_active: row.is_active,
    notes: row.notes,
  }));
}

export async function createBus(schoolId: string, input: BusInput) {
  return supabase.from('buses').insert({ school_id: schoolId, ...input });
}

export async function updateBus(busId: string, input: Partial<BusInput> & { is_active?: boolean }) {
  return supabase.from('buses').update(input).eq('id', busId);
}
