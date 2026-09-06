import { supabase } from '../supabaseClient';

export interface StudentRow {
  id: string;
  student_code: string;
  name_en: string;
  name_ar: string | null;
  grade: string | null;
  class_name: string | null;
  gender: 'male' | 'female' | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  special_notes: string | null;
  is_active: boolean;
  guardian_user_id: string | null;
}

export interface StudentInput {
  student_code: string;
  name_en: string;
  name_ar?: string | null;
  grade?: string | null;
  class_name?: string | null;
  gender?: 'male' | 'female' | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  special_notes?: string | null;
}

export async function fetchStudents(schoolId: string): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from('students')
    .select(
      'id, student_code, name_en, name_ar, grade, class_name, gender, guardian_name, guardian_phone, special_notes, is_active, guardian_user_id'
    )
    .eq('school_id', schoolId)
    .order('name_en', { ascending: true });

  if (error || !data) return [];
  return data as StudentRow[];
}

export async function createStudent(schoolId: string, input: StudentInput) {
  return supabase.from('students').insert({ school_id: schoolId, ...input });
}

export async function updateStudent(studentId: string, input: Partial<StudentInput> & { is_active?: boolean }) {
  return supabase.from('students').update(input).eq('id', studentId);
}
