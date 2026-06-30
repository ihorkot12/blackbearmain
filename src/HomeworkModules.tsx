import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Award,
  Archive,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  FileCheck2,
  FileSpreadsheet,
  Info,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';

type HomeworkExercise = {
  id?: string;
  name: string;
  target: string;
  sets?: number;
  reps?: string;
  rest?: string;
  note?: string;
  level?: string;
  equipment?: string;
  explanation?: string;
  cues?: string[];
  mistakes?: string[];
  safety?: string;
  progression?: string;
  diary_prompt?: string;
};

type HomeworkSuggestion = {
  title: string;
  description: string;
  focus: string;
  difficulty: string;
  estimated_minutes: number;
  exercises: HomeworkExercise[];
  coach_note?: string;
  recommended_for?: string;
};

type HomeworkItem = {
  id?: number;
  assignment_participant_id?: number;
  assignment_id?: number;
  title: string;
  description?: string;
  focus?: string;
  difficulty?: string;
  estimated_minutes?: number;
  due_date?: string;
  exercises?: HomeworkExercise[];
  status?: string;
  diary_entries?: any[];
  total_minutes?: number;
  parent_comment?: string;
  coach_feedback?: string;
  points_awarded?: number;
  participant_name?: string;
  group_name?: string;
  submitted_at?: string;
  reviewed_at?: string;
  recipients_count?: number;
  assigned_count?: number;
  in_progress_count?: number;
  submitted_count?: number;
  approved_count?: number;
  needs_work_count?: number;
};

type HomeworkLibrarySummary = {
  count?: number;
  focuses?: Array<{ id: string; label: string; count: number }>;
  focusCounts?: Record<string, number>;
} | null;

type HomeworkDraft = {
  diary_entries: any[];
  parent_comment: string;
  total_minutes: number;
};

const focusOptions = [
  { id: 'technique', label: 'Техніка', icon: Target },
  { id: 'kata', label: 'Ката', icon: BookOpenCheck },
  { id: 'conditioning', label: 'Фізика', icon: Dumbbell },
  { id: 'flexibility', label: 'Гнучкість', icon: Sparkles },
  { id: 'discipline', label: 'Дисципліна', icon: ClipboardCheck },
];

const difficultyOptions = [
  { id: 'easy', label: 'Легко' },
  { id: 'medium', label: 'Норма' },
  { id: 'hard', label: 'Сильно' },
];

const statusLabel = (status?: string) => {
  if (status === 'approved') return 'Перевірено';
  if (status === 'needs_work') return 'Є правки';
  if (status === 'submitted') return 'На перевірці';
  if (status === 'in_progress') return 'В роботі';
  return 'Нове';
};

const statusClasses = (status?: string) => {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  if (status === 'needs_work') return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  if (status === 'submitted') return 'bg-blue-500/15 text-blue-300 border-blue-500/20';
  if (status === 'in_progress') return 'bg-zinc-400/10 text-zinc-300 border-zinc-400/20';
  return 'bg-red-500/15 text-red-300 border-red-500/20';
};

const difficultyLabel = (value?: string) => {
  if (value === 'easy') return 'легко';
  if (value === 'hard') return 'сильно';
  return 'норма';
};

const formatDate = (value?: string) => {
  if (!value) return 'без дедлайну';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
};

const nextDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeExercises = (value: unknown): HomeworkExercise[] => {
  if (Array.isArray(value)) return value as HomeworkExercise[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const adminRequest = async (url: string, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
      ...(options.headers || {}),
    },
  });

const parentRequest = async (url: string, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('parent_token') || ''}`,
      ...(options.headers || {}),
    },
  });

const ExerciseList = ({ exercises }: { exercises: HomeworkExercise[] }) => (
  <div className="grid gap-3">
    {exercises.map((exercise, index) => (
      <div key={`${exercise.id || exercise.name}-${index}`} className="rounded-2xl border border-white/5 bg-black/25 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="font-black text-white">{exercise.name}</p>
            <p className="mt-1 text-sm text-zinc-400">{exercise.target}</p>
          </div>
          <div className="shrink-0 rounded-xl bg-red-600/15 px-3 py-1 text-xs font-black text-red-300">
            {exercise.sets || 1} сет
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
          {exercise.reps && <span className="rounded-lg bg-white/5 px-3 py-1">{exercise.reps}</span>}
          {exercise.rest && <span className="rounded-lg bg-white/5 px-3 py-1">пауза {exercise.rest}</span>}
        </div>
        {exercise.note && <p className="mt-3 text-xs leading-relaxed text-zinc-500">{exercise.note}</p>}
      </div>
    ))}
  </div>
);

const levelLabel = (level?: string) => {
  if (level === 'beginner') return 'база';
  if (level === 'intermediate') return 'середній';
  if (level === 'advanced') return 'досвідчені';
  return '';
};

const ExerciseDetailsList = ({ exercises }: { exercises: HomeworkExercise[] }) => {
  const [openExerciseKey, setOpenExerciseKey] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {exercises.map((exercise, index) => {
        const key = `${exercise.id || exercise.name}-${index}`;
        const isOpen = openExerciseKey === key;
        const hasDetails = Boolean(
          exercise.explanation ||
          exercise.cues?.length ||
          exercise.mistakes?.length ||
          exercise.safety ||
          exercise.progression ||
          exercise.diary_prompt ||
          exercise.equipment ||
          exercise.level
        );

        return (
          <div key={key} className="overflow-hidden rounded-2xl border border-white/5 bg-black/25">
            <button
              type="button"
              onClick={() => hasDetails && setOpenExerciseKey(isOpen ? null : key)}
              className="w-full p-4 text-left transition-colors hover:bg-white/[0.03]"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{exercise.name}</p>
                  <p className="mt-1 text-sm text-zinc-400">{exercise.target}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-xl bg-red-600/15 px-3 py-1 text-xs font-black text-red-300">
                    {exercise.sets || 1} сет
                  </div>
                  {hasDetails && <ChevronDown className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} />}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                {exercise.reps && <span className="rounded-lg bg-white/5 px-3 py-1">{exercise.reps}</span>}
                {exercise.rest && <span className="rounded-lg bg-white/5 px-3 py-1">пауза {exercise.rest}</span>}
                {exercise.equipment && <span className="rounded-lg bg-white/5 px-3 py-1">{exercise.equipment}</span>}
                {levelLabel(exercise.level) && <span className="rounded-lg bg-red-500/10 px-3 py-1 text-red-200/80">{levelLabel(exercise.level)}</span>}
              </div>
              {exercise.note && <p className="mt-3 text-xs leading-relaxed text-zinc-500">{exercise.note}</p>}
              {hasDetails && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase text-red-300">
                  <Info size={14} />
                  {isOpen ? 'згорнути пояснення' : 'відкрити пояснення'}
                </div>
              )}
            </button>

            <AnimatePresence initial={false}>
              {isOpen && hasDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    {exercise.explanation && (
                      <p className="rounded-xl bg-white/[0.03] p-3 text-sm leading-relaxed text-zinc-300">
                        {exercise.explanation}
                      </p>
                    )}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {exercise.cues?.length ? (
                        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                          <p className="mb-2 text-xs font-black uppercase text-emerald-300">Ключі техніки</p>
                          <ul className="space-y-1 text-xs leading-relaxed text-zinc-300">
                            {exercise.cues.map((cue, cueIndex) => <li key={cueIndex}>• {cue}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {exercise.mistakes?.length ? (
                        <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
                          <p className="mb-2 text-xs font-black uppercase text-amber-300">Типові помилки</p>
                          <ul className="space-y-1 text-xs leading-relaxed text-zinc-300">
                            {exercise.mistakes.map((mistake, mistakeIndex) => <li key={mistakeIndex}>• {mistake}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {exercise.safety && (
                        <p className="rounded-xl bg-red-500/10 p-3 text-xs leading-relaxed text-red-100/80">
                          <span className="mb-1 block font-black uppercase text-red-300">Безпека</span>
                          {exercise.safety}
                        </p>
                      )}
                      {exercise.progression && (
                        <p className="rounded-xl bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-100/80">
                          <span className="mb-1 block font-black uppercase text-blue-300">Ускладнення</span>
                          {exercise.progression}
                        </p>
                      )}
                      {exercise.diary_prompt && (
                        <p className="rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-zinc-300">
                          <span className="mb-1 block font-black uppercase text-zinc-100">Щоденник</span>
                          {exercise.diary_prompt}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const difficultyHints: Record<string, string> = {
  easy: 'Молодша група або новачки: база, контроль форми, без гонки за кількістю.',
  medium: 'Середня група: стабільний темп, прості зв’язки, чесний короткий щоденник.',
  hard: 'Старша група або дорослі досвідчені: більше обсягу, темпу і самоконтролю.',
};

const suggestDifficultyForGroup = (groupName?: string) => {
  const value = String(groupName || '').toLowerCase();
  if (!value) return '';
  if (value.includes('старш') || value.includes('дорос') || value.includes('12+') || value.includes('advanced')) return 'hard';
  if (value.includes('серед') || value.includes('middle') || value.includes('8+') || value.includes('9+') || value.includes('10+')) return 'medium';
  if (value.includes('молод') || value.includes('новач') || value.includes('почат') || value.includes('kids')) return 'easy';
  return '';
};

export const HomeworkCoachModule = ({ role, coachId }: { role: string; coachId: number | null }) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<HomeworkItem[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkItem[]>([]);
  const [suggestions, setSuggestions] = useState<HomeworkSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<HomeworkSuggestion | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [focus, setFocus] = useState('technique');
  const [difficulty, setDifficulty] = useState('medium');
  const [minutes, setMinutes] = useState(15);
  const [variantCount, setVariantCount] = useState(12);
  const [dueDate, setDueDate] = useState(nextDate(7));
  const [librarySummary, setLibrarySummary] = useState<HomeworkLibrarySummary>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { coach_feedback: string; points_awarded: number }>>({});

  const filteredParticipants = useMemo(() => {
    if (!selectedGroupId) return participants;
    return participants.filter(item => String(item.group_id || '') === selectedGroupId);
  }, [participants, selectedGroupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupsRes, participantsRes, assignmentsRes, submissionsRes, libraryRes] = await Promise.all([
        adminRequest('/api/groups'),
        adminRequest('/api/participants'),
        adminRequest('/api/homework'),
        adminRequest('/api/homework/submissions'),
        adminRequest('/api/homework/library'),
      ]);
      setGroups(groupsRes.ok ? await groupsRes.json() : []);
      setParticipants(participantsRes.ok ? await participantsRes.json() : []);
      setAssignments(assignmentsRes.ok ? await assignmentsRes.json() : []);
      setSubmissions(submissionsRes.ok ? await submissionsRes.json() : []);
      setLibrarySummary(libraryRes.ok ? await libraryRes.json() : null);
    } catch {
      toast.error('Не вдалося завантажити домашні завдання');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const selectedGroup = groups.find(group => String(group.id) === selectedGroupId);
      const res = await adminRequest('/api/homework/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus,
          difficulty,
          estimated_minutes: minutes,
          count: variantCount,
          group_name: selectedGroup?.name || '',
          seed: Date.now(),
        }),
      });
      const data = await res.json();
      const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(nextSuggestions);
      setSelectedSuggestion(nextSuggestions[0] || null);
      if (data.library) setLibrarySummary(data.library);
    } catch {
      toast.error('Не вдалося згенерувати ДЗ');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadHomeworkLibrary = async () => {
    try {
      const res = await adminRequest('/api/homework/library');
      const data = await res.json();
      const exercises = Array.isArray(data.exercises) ? data.exercises : [];
      if (exercises.length === 0) {
        toast.error('Бібліотека вправ порожня');
        return;
      }
      const headers = ['focus', 'level', 'name', 'target', 'sets', 'reps', 'rest', 'equipment', 'note', 'explanation', 'safety', 'progression', 'diary_prompt'];
      const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""').replace(/\r?\n/g, ' ')}"`;
      const csv = [
        headers.join(';'),
        ...exercises.map((exercise: any) => headers.map(header => escapeCsv(exercise[header])).join(';')),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'black-bear-homework-library.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Не вдалося завантажити таблицю вправ');
    }
  };

  const toggleParticipant = (id: number) => {
    setSelectedParticipantIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };

  const handleSend = async () => {
    if (!selectedSuggestion) {
      toast.error('Спочатку згенеруйте або оберіть ДЗ');
      return;
    }
    if (!selectedGroupId && selectedParticipantIds.length === 0) {
      toast.error('Оберіть групу або окремих учнів');
      return;
    }

    setIsSending(true);
    try {
      const res = await adminRequest('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedSuggestion,
          due_date: dueDate || null,
          group_id: selectedGroupId || null,
          participant_ids: selectedParticipantIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Не вдалося розіслати ДЗ');
        return;
      }
      toast.success(`ДЗ розіслано: ${data.count} учнів`);
      setSuggestions([]);
      setSelectedSuggestion(null);
      setSelectedParticipantIds([]);
      fetchData();
    } catch {
      toast.error('Помилка розсилки');
    } finally {
      setIsSending(false);
    }
  };

  const archiveAssignment = async (item: HomeworkItem) => {
    if (!item.id || !window.confirm('Архівувати це домашнє завдання? Воно зникне з активних списків, але історія залишиться.')) return;
    setArchivingId(item.id);
    try {
      const res = await adminRequest(`/api/homework/${item.id}/archive`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Не вдалося архівувати ДЗ');
        return;
      }
      toast.success('ДЗ перенесено в архів');
      fetchData();
    } catch {
      toast.error('Помилка архівації');
    } finally {
      setArchivingId(null);
    }
  };

  const deleteAssignment = async (item: HomeworkItem) => {
    if (!item.id || !window.confirm('Видалити помилкове ДЗ? Це можна робити тільки якщо учні ще не почали виконання.')) return;
    setDeletingId(item.id);
    try {
      const res = await adminRequest(`/api/homework/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(res.status === 409 ? 'Учні вже почали виконання. Краще архівувати.' : data.error || 'Не вдалося видалити ДЗ');
        return;
      }
      toast.success('Помилкове ДЗ видалено');
      fetchData();
    } catch {
      toast.error('Помилка видалення');
    } finally {
      setDeletingId(null);
    }
  };

  const reviewSubmission = async (submission: HomeworkItem, status: 'approved' | 'needs_work') => {
    if (!submission.id) return;
    const draft = reviewDrafts[submission.id] || { coach_feedback: '', points_awarded: status === 'approved' ? 5 : 0 };
    setReviewingId(submission.id);
    try {
      const res = await adminRequest(`/api/homework/submissions/${submission.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Не вдалося перевірити');
        return;
      }
      toast.success(status === 'approved' ? 'ДЗ зараховано' : 'Відправлено на доопрацювання');
      setSubmissions(current => current.filter(item => item.id !== submission.id));
      setReviewDrafts(current => {
        const next = { ...current };
        delete next[submission.id || 0];
        return next;
      });
      fetchData();
    } catch {
      toast.error('Помилка перевірки');
    } finally {
      setReviewingId(null);
    }
  };

  const submitted = submissions.filter(item => item.status === 'submitted');

  return (
    <div className="space-y-8">
      <header className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-black uppercase text-red-500">Домашня робота</p>
          <h2 className="text-4xl font-black uppercase text-white lg:text-5xl">ДЗ для груп і учнів</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Тренер генерує завдання, обирає групу або конкретних учнів, розсилає в кабінети, а потім перевіряє щоденники виконання.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'активні', value: assignments.length, icon: CalendarClock },
            { label: 'на перевірці', value: submitted.length, icon: FileCheck2 },
            { label: role === 'coach' ? 'тренер' : 'роль', value: role === 'coach' ? `#${coachId || '-'}` : 'admin', icon: Users },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
              <item.icon className="mb-3 text-red-500" size={18} />
              <div className="text-2xl font-black text-white">{item.value}</div>
              <div className="text-xs font-bold uppercase text-zinc-500">{item.label}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-5 rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black uppercase text-white">Генератор</h3>
              <p className="mt-1 text-sm text-zinc-500">Оберіть акцент і згенеруйте 3 варіанти.</p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex h-12 items-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black uppercase text-white transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Генерувати
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-black uppercase text-zinc-500">Акцент</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {focusOptions.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFocus(item.id)}
                    className={`rounded-2xl border p-3 text-left transition-all ${focus === item.id ? 'border-red-500/40 bg-red-500/10 text-white' : 'border-white/5 bg-white/[0.03] text-zinc-500 hover:text-white'}`}
                  >
                    <item.icon size={18} />
                    <span className="mt-2 block text-xs font-black uppercase">{item.label}</span>
                  </button>
                ))}
              </div>
              {librarySummary && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
                  <span className="rounded-lg bg-white/5 px-3 py-1">База: {librarySummary.count || 0} вправ</span>
                  {librarySummary.focuses?.map(item => (
                    <span key={item.id} className="rounded-lg bg-white/5 px-3 py-1">{item.label}: {item.count}</span>
                  ))}
                  <button type="button" onClick={downloadHomeworkLibrary} className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1 text-red-300 hover:bg-red-500/20">
                    <FileSpreadsheet size={13} />
                    таблиця
                  </button>
                </div>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Складність</span>
              <select value={difficulty} onChange={event => setDifficulty(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none">
                {difficultyOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <span className="mt-2 block text-xs leading-relaxed text-zinc-500">{difficultyHints[difficulty]}</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Хвилин</span>
              <input type="number" min={5} max={60} value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Варіантів</span>
              <select value={variantCount} onChange={event => setVariantCount(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none">
                {[6, 12, 18, 24].map(count => <option key={count} value={count}>{count} ДЗ</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Група</span>
              <select
                value={selectedGroupId}
                onChange={event => {
                  const nextGroupId = event.target.value;
                  const nextGroup = groups.find(group => String(group.id) === nextGroupId);
                  const suggestedDifficulty = suggestDifficultyForGroup(nextGroup?.name);
                  setSelectedGroupId(nextGroupId);
                  setSelectedParticipantIds([]);
                  if (suggestedDifficulty) setDifficulty(suggestedDifficulty);
                }}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none"
              >
                <option value="">Окремі учні</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Дедлайн</span>
              <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none" />
            </label>
          </div>

          {!selectedGroupId && (
            <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase text-zinc-500">Окремі учні</p>
                <button type="button" onClick={() => setSelectedParticipantIds(filteredParticipants.map(item => item.id))} className="text-xs font-bold text-red-400">обрати всіх</button>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {filteredParticipants.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleParticipant(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${selectedParticipantIds.includes(item.id) ? 'border-red-500/30 bg-red-500/10 text-white' : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:text-white'}`}
                  >
                    <span className="font-bold">{item.name}</span>
                    <span className="text-xs text-zinc-500">{item.group_name || 'без групи'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !selectedSuggestion}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Розіслати в кабінети
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black uppercase text-white">Варіанти ДЗ</h3>
            <button type="button" onClick={fetchData} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">
              <RefreshCw size={14} />
              Оновити
            </button>
          </div>

          {suggestions.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-zinc-900/30 p-12 text-center">
              <Sparkles className="mx-auto mb-4 text-zinc-700" size={46} />
              <p className="font-bold text-zinc-500">Натисніть “Генерувати”, щоб отримати варіанти.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suggestions.map((suggestion, index) => {
                const selected = selectedSuggestion?.title === suggestion.title;
                return (
                  <div
                    key={`${suggestion.title}-${index}`}
                    className={`rounded-[2rem] border p-5 transition-all ${selected ? 'border-red-500/40 bg-red-500/10' : 'border-white/5 bg-zinc-900/50 hover:border-white/15'}`}
                  >
                    <button type="button" onClick={() => setSelectedSuggestion(suggestion)} className="mb-4 flex w-full items-start justify-between gap-4 text-left">
                      <div>
                        <h4 className="text-xl font-black uppercase text-white">{suggestion.title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{suggestion.description}</p>
                        {suggestion.recommended_for && <p className="mt-2 text-xs font-bold uppercase text-red-300">{suggestion.recommended_for}</p>}
                      </div>
                      {selected && <CheckCircle2 className="text-red-400" size={24} />}
                    </button>
                    <ExerciseDetailsList exercises={suggestion.exercises} />
                    {suggestion.coach_note && <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100/80">{suggestion.coach_note}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <h3 className="mb-5 text-2xl font-black uppercase text-white">Активні розсилки</h3>
          <div className="space-y-3">
            {assignments.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="text-sm text-zinc-500">{item.group_name || 'окремі учні'} · дедлайн {formatDate(item.due_date)}</p>
                  </div>
                  <span className="rounded-xl bg-white/5 px-3 py-1 text-xs font-black text-zinc-300">{item.recipients_count || 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold sm:grid-cols-5">
                  <div className="rounded-xl bg-white/5 p-2 text-zinc-300">нові {item.assigned_count || 0}</div>
                  <div className="rounded-xl bg-zinc-500/10 p-2 text-zinc-300">в роботі {item.in_progress_count || 0}</div>
                  <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">на перевірці {item.submitted_count || 0}</div>
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">готово {item.approved_count || 0}</div>
                  <div className="rounded-xl bg-amber-500/10 p-2 text-amber-300">правки {item.needs_work_count || 0}</div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => archiveAssignment(item)}
                    disabled={archivingId === item.id}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase text-zinc-200 transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    {archivingId === item.id ? <Loader2 className="animate-spin" size={14} /> : <Archive size={14} />}
                    Архів
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAssignment(item)}
                    disabled={deletingId === item.id}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-black uppercase text-red-200 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {deletingId === item.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    Видалити помилкове
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && assignments.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Розсилок ще немає</div>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <h3 className="mb-5 text-2xl font-black uppercase text-white">Перевірка щоденників</h3>
          <div className="space-y-4">
            {submitted.slice(0, 12).map(item => {
              const exercises = normalizeExercises(item.exercises);
              const draft = reviewDrafts[item.id || 0] || { coach_feedback: item.coach_feedback || '', points_awarded: item.status === 'approved' ? Number(item.points_awarded || 0) : 5 };
              const isReviewing = reviewingId === item.id;
              return (
                <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(item.status)}`}>{statusLabel(item.status)}</span>
                        <span className="text-xs font-bold text-zinc-500">{item.group_name || 'без групи'}</span>
                      </div>
                      <p className="font-black text-white">{item.participant_name}</p>
                      <p className="text-sm text-zinc-400">{item.title}</p>
                    </div>
                    <div className="text-sm font-bold text-zinc-500">{item.total_minutes || 0} хв</div>
                  </div>

                  <div className="mb-4 grid gap-2">
                    {(item.diary_entries || []).map((entry: any, index: number) => (
                      <div key={index} className="rounded-xl bg-black/25 p-3 text-sm text-zinc-300">
                        <span className="font-bold text-white">{entry.exercise_name || exercises[index]?.name || 'Вправа'}:</span> {entry.sets_done || 0} сетів, {entry.reps_done || 'без повторів'}, {entry.minutes || 0} хв
                        {entry.note && <p className="mt-1 text-xs text-zinc-500">{entry.note}</p>}
                      </div>
                    ))}
                    {item.parent_comment && <p className="rounded-xl bg-blue-500/10 p-3 text-sm text-blue-100/80">Коментар: {item.parent_comment}</p>}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                    <input
                      value={draft.coach_feedback}
                      onChange={event => setReviewDrafts(current => ({ ...current, [item.id || 0]: { ...draft, coach_feedback: event.target.value } }))}
                      placeholder="Коментар тренера..."
                      className="h-12 rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={draft.points_awarded}
                      onChange={event => setReviewDrafts(current => ({ ...current, [item.id || 0]: { ...draft, points_awarded: Number(event.target.value) } }))}
                      className="h-12 rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => reviewSubmission(item, 'approved')} disabled={isReviewing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black uppercase text-black disabled:opacity-50">
                      {isReviewing ? <Loader2 className="animate-spin" size={16} /> : <Award size={16} />}
                      Зарахувати
                    </button>
                    <button type="button" onClick={() => reviewSubmission(item, 'needs_work')} disabled={isReviewing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black uppercase text-black disabled:opacity-50">
                      {isReviewing ? <Loader2 className="animate-spin" size={16} /> : <MessageSquareText size={16} />}
                      На правки
                    </button>
                  </div>
                </div>
              );
            })}
            {!isLoading && submitted.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Щоденників на перевірку немає</div>}
          </div>
        </div>
      </section>
    </div>
  );
};

type HomeworkFocusTarget = {
  id?: number | null;
  title?: string;
  nonce?: number;
} | null;

export const HomeworkParentDiary = ({
  participantId,
  focusTarget,
  audience = 'family',
}: {
  participantId?: number | null;
  focusTarget?: HomeworkFocusTarget;
  audience?: 'family' | 'adult';
}) => {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, HomeworkDraft>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const buildDraft = (item: HomeworkItem): HomeworkDraft => {
    const exercises = normalizeExercises(item.exercises);
    const currentEntries = Array.isArray(item.diary_entries) && item.diary_entries.length > 0
      ? item.diary_entries
      : exercises.map((exercise, index) => ({
          exercise_id: exercise.id || `exercise_${index + 1}`,
          exercise_name: exercise.name,
          sets_done: 0,
          reps_done: '',
          minutes: 0,
          note: '',
        }));

    return {
      diary_entries: currentEntries,
      parent_comment: item.parent_comment || '',
      total_minutes: Number(item.total_minutes || currentEntries.reduce((sum: number, entry: any) => sum + Number(entry.minutes || 0), 0)),
    };
  };

  const resolveFocusedHomeworkId = (list: HomeworkItem[]) => {
    const targetId = Number(focusTarget?.id || 0);
    if (Number.isFinite(targetId) && targetId > 0) {
      const byParticipantAssignment = list.find(item => Number(item.assignment_participant_id) === targetId);
      if (byParticipantAssignment?.assignment_participant_id) return byParticipantAssignment.assignment_participant_id;

      const byAssignment = list.find(item => Number(item.assignment_id) === targetId);
      if (byAssignment?.assignment_participant_id) return byAssignment.assignment_participant_id;
    }

    const targetTitle = String(focusTarget?.title || '').trim().toLowerCase();
    if (targetTitle) {
      const byTitle = list.find(item => {
        const itemTitle = String(item.title || '').toLowerCase();
        return itemTitle.includes(targetTitle) || targetTitle.includes(itemTitle);
      });
      if (byTitle?.assignment_participant_id) return byTitle.assignment_participant_id;
    }

    return null;
  };

  const fetchHomework = async () => {
    setIsLoading(true);
    try {
      const res = await parentRequest('/api/parent/homework');
      const data = res.ok ? await res.json() : [];
      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      const nextDrafts: Record<number, HomeworkDraft> = {};
      nextItems.forEach((item: HomeworkItem) => {
        if (item.assignment_participant_id) nextDrafts[item.assignment_participant_id] = buildDraft(item);
      });
      setDrafts(nextDrafts);
      const focusedId = resolveFocusedHomeworkId(nextItems);
      if (focusedId) setExpandedId(focusedId);
      else if (!expandedId && nextItems[0]?.assignment_participant_id) setExpandedId(nextItems[0].assignment_participant_id);
    } catch {
      toast.error('Не вдалося завантажити домашні завдання');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomework();
  }, [participantId]);

  useEffect(() => {
    const focusedId = resolveFocusedHomeworkId(items);
    if (!focusedId) return;
    setExpandedId(focusedId);
    window.setTimeout(() => {
      document.getElementById(`homework-item-${focusedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [focusTarget?.nonce]);

  const updateEntry = (itemId: number, entryIndex: number, field: string, value: any) => {
    setDrafts(current => {
      const draft = current[itemId];
      if (!draft) return current;
      const diary_entries = draft.diary_entries.map((entry, index) =>
        index === entryIndex ? { ...entry, [field]: value } : entry
      );
      const total_minutes = diary_entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
      return { ...current, [itemId]: { ...draft, diary_entries, total_minutes } };
    });
  };

  const saveDiary = async (item: HomeworkItem, status: 'in_progress' | 'submitted') => {
    const id = item.assignment_participant_id;
    if (!id || !drafts[id]) return;
    setSavingId(id);
    try {
      const res = await parentRequest(`/api/parent/homework/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...drafts[id], status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Не вдалося зберегти щоденник');
        return;
      }
      toast.success(status === 'submitted' ? 'Відправлено тренеру' : 'Щоденник збережено');
      fetchHomework();
    } catch {
      toast.error('Помилка збереження');
    } finally {
      setSavingId(null);
    }
  };

  const activeCount = items.filter(item => !['approved'].includes(item.status || '')).length;
  const introText = audience === 'adult'
    ? 'Тут ви відмічаєте домашню роботу: скільки сетів, повторів, хвилин і що було складно.'
    : 'Тут дитина або батьки відмічають, що зроблено вдома: скільки сетів, повторів, хвилин і що було складно.';

  return (
    <div className="space-y-8">
      <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-black uppercase text-red-500">Домашній щоденник</p>
          <h2 className="text-4xl font-black uppercase text-white lg:text-5xl">Домашні завдання</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {introText}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
            <Clock3 className="mb-3 text-red-500" size={18} />
            <div className="text-2xl font-black text-white">{activeCount}</div>
            <div className="text-xs font-bold uppercase text-zinc-500">активні</div>
          </div>
          <button type="button" onClick={fetchHomework} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 text-left transition-colors hover:bg-zinc-900">
            <RefreshCw className="mb-3 text-red-500" size={18} />
            <div className="text-sm font-black uppercase text-white">Оновити</div>
            <div className="text-xs font-bold uppercase text-zinc-500">список</div>
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-red-600" size={42} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-zinc-900/30 p-16 text-center">
          <ClipboardCheck className="mx-auto mb-4 text-zinc-700" size={52} />
          <p className="font-bold text-zinc-500">Домашніх завдань поки немає</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const id = item.assignment_participant_id || 0;
            const draft = drafts[id] || buildDraft(item);
            const exercises = normalizeExercises(item.exercises);
            const expanded = expandedId === id;
            return (
              <div id={`homework-item-${id}`} key={id} className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950">
                <button type="button" onClick={() => setExpandedId(expanded ? null : id)} className="flex w-full flex-col gap-4 p-5 text-left md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(item.status)}`}>{statusLabel(item.status)}</span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-500">до {formatDate(item.due_date)}</span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-500">{difficultyLabel(item.difficulty)}</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase text-white">{item.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-red-600/10 px-4 py-3 text-center">
                      <div className="text-xl font-black text-red-300">{item.estimated_minutes || 15}</div>
                      <div className="text-xs font-bold uppercase text-red-200/60">хв</div>
                    </div>
                    <ChevronDown className={`text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} size={22} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 p-5">
                        <ExerciseDetailsList exercises={exercises} />

                        <div className="mt-6 space-y-3">
                          <h4 className="font-black uppercase text-white">Щоденник виконання</h4>
                          {draft.diary_entries.map((entry, index) => (
                            <div key={`${entry.exercise_id}-${index}`} className="grid gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 md:grid-cols-[1fr_7rem_8rem_7rem]">
                              <div>
                                <p className="font-bold text-white">{entry.exercise_name || exercises[index]?.name || `Вправа ${index + 1}`}</p>
                                <input
                                  value={entry.note || ''}
                                  onChange={event => updateEntry(id, index, 'note', event.target.value)}
                                  placeholder="Що було складно?"
                                  className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none"
                                />
                              </div>
                              <label className="block">
                                <span className="mb-1 block text-xs font-bold text-zinc-500">Сети</span>
                                <input type="number" min={0} value={entry.sets_done || 0} onChange={event => updateEntry(id, index, 'sets_done', Number(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs font-bold text-zinc-500">Повтори</span>
                                <input value={entry.reps_done || ''} onChange={event => updateEntry(id, index, 'reps_done', event.target.value)} placeholder="10/20 сек" className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs font-bold text-zinc-500">Хв</span>
                                <input type="number" min={0} value={entry.minutes || 0} onChange={event => updateEntry(id, index, 'minutes', Number(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none" />
                              </label>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_13rem]">
                          <textarea
                            value={draft.parent_comment}
                            onChange={event => setDrafts(current => ({ ...current, [id]: { ...draft, parent_comment: event.target.value } }))}
                            placeholder="Коментар від батьків або дитини..."
                            className="min-h-24 rounded-2xl border border-white/10 bg-black p-4 text-sm text-white outline-none"
                          />
                          <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                            <p className="text-xs font-bold uppercase text-zinc-500">Разом часу</p>
                            <div className="mt-2 text-3xl font-black text-white">{draft.total_minutes || 0} хв</div>
                            {item.coach_feedback && (
                              <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100/80">{item.coach_feedback}</p>
                            )}
                            {Number(item.points_awarded || 0) > 0 && (
                              <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-black text-emerald-300">+{item.points_awarded} балів</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <button type="button" onClick={() => saveDiary(item, 'in_progress')} disabled={savingId === id} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-black uppercase text-white transition-colors hover:bg-white/10 disabled:opacity-50">
                            {savingId === id ? <Loader2 className="animate-spin" size={18} /> : <ClipboardCheck size={18} />}
                            Зберегти
                          </button>
                          <button type="button" onClick={() => saveDiary(item, 'submitted')} disabled={savingId === id} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-black uppercase text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                            {savingId === id ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            Відправити тренеру
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
