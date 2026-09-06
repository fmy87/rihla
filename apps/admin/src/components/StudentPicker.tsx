import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchStudents, type StudentRow } from '../lib/queries/students';
import { findExistingAssignment, assignStudentToStop, reassignStudent } from '../lib/queries/routes';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../lib/formStyles';

interface StudentPickerProps {
  schoolId: string;
  routeId: string;
  stopId: string;
  alreadyAssignedIds: string[];
  onAssigned: () => void;
}

export default function StudentPicker({ schoolId, routeId, stopId, alreadyAssignedIds, onAssigned }: StudentPickerProps) {
  const { t } = useTranslation(['routes', 'students', 'common']);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [conflict, setConflict] = useState<{ student: StudentRow; assignmentId: string; routeName: string } | null>(
    null
  );

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const all = await fetchStudents(schoolId);
    setSearching(false);
    const q = value.toLowerCase();
    setResults(
      all
        .filter((s) => !alreadyAssignedIds.includes(s.id))
        .filter((s) => s.name_en.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }

  async function handlePick(student: StudentRow) {
    const { data: existing } = await findExistingAssignment(student.id);
    if (existing) {
      // @ts-expect-error -- joined field
      const routeName = existing.routes?.name_en ?? t('routes:anotherRoute');
      setConflict({ student, assignmentId: existing.id, routeName });
      return;
    }
    await assignStudentToStop(student.id, routeId, stopId);
    setQuery('');
    setResults([]);
    onAssigned();
  }

  async function confirmReassign() {
    if (!conflict) return;
    await reassignStudent(conflict.assignmentId, routeId, stopId);
    setConflict(null);
    setQuery('');
    setResults([]);
    onAssigned();
  }

  return (
    <div>
      <input
        className={inputClass}
        placeholder={t('routes:searchStudents')}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {searching && <p className="mt-1 text-xs text-slate-400">{t('common:loading')}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {s.name_en} <span className="text-slate-400">· {s.student_code}</span>
              </span>
              <button onClick={() => handlePick(s)} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                {t('routes:assign')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {conflict && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-amber-800">
            {t('routes:duplicateAssignmentWarning', { name: conflict.student.name_en, route: conflict.routeName })}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setConflict(null)} className={secondaryButtonClass}>
              {t('common:common.cancel')}
            </button>
            <button onClick={confirmReassign} className={primaryButtonClass}>
              {t('routes:reassign')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
