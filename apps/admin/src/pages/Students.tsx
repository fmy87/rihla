import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchStudents,
  createStudent,
  updateStudent,
  type StudentRow,
  type StudentInput,
} from '../lib/queries/students';
import { createGuardianInvite, buildInviteUrl } from '../lib/queries/guardianInvites';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, statusBadgeClass } from '../lib/formStyles';

const EMPTY_FORM: StudentInput = {
  student_code: '',
  name_en: '',
  name_ar: '',
  grade: '',
  class_name: '',
  gender: null,
  guardian_name: '',
  guardian_phone: '',
  special_notes: '',
};

export default function StudentsPage() {
  const { t } = useTranslation(['students', 'common']);
  const { profile } = useAuth();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StudentInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ studentName: string; url: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  async function reload() {
    if (!profile?.school_id) return;
    setStudents(await fetchStudents(profile.school_id));
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [profile?.school_id]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(student: StudentRow) {
    setEditing(student);
    setForm({
      student_code: student.student_code,
      name_en: student.name_en,
      name_ar: student.name_ar ?? '',
      grade: student.grade ?? '',
      class_name: student.class_name ?? '',
      gender: student.gender,
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
      special_notes: student.special_notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setSaving(true);
    setError(null);

    const { error: saveError } = editing
      ? await updateStudent(editing.id, form)
      : await createStudent(profile.school_id, form);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setShowForm(false);
    reload();
  }

  async function toggleActive(student: StudentRow) {
    await updateStudent(student.id, { is_active: !student.is_active });
    reload();
  }

  async function handleInvite(student: StudentRow) {
    if (!profile) return;
    setInvitingId(student.id);
    setInviteError(null);
    const { token, error: createError } = await createGuardianInvite(profile.school_id, student.id, profile.id);
    setInvitingId(null);
    if (createError || !token) {
      setInviteError(createError ?? 'unknown_error');
      return;
    }
    const base = import.meta.env.VITE_PARENT_PORTAL_URL || 'https://parent.yourschool.example';
    setInviteLink({ studentName: student.name_en, url: buildInviteUrl(base, token) });
  }

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name_en.toLowerCase().includes(q) ||
      s.student_code.toLowerCase().includes(q) ||
      (s.name_ar ?? '').includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{t('common:nav.students')}</h1>
        <button onClick={openCreate} className={primaryButtonClass}>
          {t('students:addStudent')}
        </button>
      </div>

      <input
        placeholder={t('students:searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputClass} mb-4 max-w-sm`}
      />

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{t('students:code')}</th>
                <th className="px-4 py-3 text-start">{t('students:name')}</th>
                <th className="px-4 py-3 text-start">{t('students:grade')}</th>
                <th className="px-4 py-3 text-start">{t('students:class')}</th>
                <th className="px-4 py-3 text-start">{t('students:guardian')}</th>
                <th className="px-4 py-3 text-start">{t('students:status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {t('students:empty')}
                  </td>
                </tr>
              )}
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{student.student_code}</td>
                  <td className="px-4 py-3 text-slate-600">{student.name_en}</td>
                  <td className="px-4 py-3 text-slate-600">{student.grade ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{student.class_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {student.guardian_name ?? '—'}
                    {student.guardian_user_id && (
                      <span className="ms-2 rounded-full bg-status-normal/10 px-2 py-0.5 text-xs font-medium text-status-normal">
                        {t('students:portalLinked')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(student.is_active)}>
                      {student.is_active ? t('students:active') : t('students:inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => openEdit(student)}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      {t('students:edit')}
                    </button>
                    <button
                      onClick={() => handleInvite(student)}
                      disabled={invitingId === student.id}
                      className="ms-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invitingId === student.id ? t('common:loading') : t('students:inviteParent')}
                    </button>
                    <button
                      onClick={() => toggleActive(student)}
                      className="ms-3 text-sm font-medium text-slate-400 hover:text-slate-700"
                    >
                      {student.is_active ? t('students:deactivate') : t('students:activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? t('students:editStudent') : t('students:addStudent')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('students:code')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.student_code}
                  onChange={(e) => setForm({ ...form, student_code: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('students:gender')}</label>
                <select
                  className={inputClass}
                  value={form.gender ?? ''}
                  onChange={(e) => setForm({ ...form, gender: (e.target.value || null) as 'male' | 'female' | null })}
                >
                  <option value="">—</option>
                  <option value="male">{t('students:male')}</option>
                  <option value="female">{t('students:female')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('students:nameEn')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('students:nameAr')}</label>
                <input
                  dir="rtl"
                  className={inputClass}
                  value={form.name_ar ?? ''}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('students:grade')}</label>
                <input
                  className={inputClass}
                  value={form.grade ?? ''}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('students:class')}</label>
                <input
                  className={inputClass}
                  value={form.class_name ?? ''}
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('students:guardian')}</label>
                <input
                  className={inputClass}
                  value={form.guardian_name ?? ''}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('students:guardianPhone')}</label>
                <input
                  className={inputClass}
                  value={form.guardian_phone ?? ''}
                  onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('students:notes')}</label>
              <textarea
                className={inputClass}
                rows={2}
                value={form.special_notes ?? ''}
                onChange={(e) => setForm({ ...form, special_notes: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-400">{t('students:notesHint')}</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className={secondaryButtonClass}>
                {t('common:common.cancel')}
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? t('common:loading') : t('common:common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {inviteError && (
        <Modal title={t('students:inviteFailedTitle')} onClose={() => setInviteError(null)}>
          <p className="text-sm text-red-600">{inviteError}</p>
        </Modal>
      )}

      {inviteLink && (
        <Modal title={t('students:inviteLinkTitle', { name: inviteLink.studentName })} onClose={() => setInviteLink(null)}>
          <p className="mb-3 text-sm text-slate-500">{t('students:inviteLinkHint')}</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink.url} className={`${inputClass} flex-1`} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => navigator.clipboard.writeText(inviteLink.url)}
            >
              {t('students:copyLink')}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t('students:inviteExpiryNote')}</p>
        </Modal>
      )}
    </AppLayout>
  );
}
