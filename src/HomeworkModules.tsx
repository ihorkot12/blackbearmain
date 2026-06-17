import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  FileCheck2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Target,
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
};

type HomeworkSuggestion = {
  title: string;
  description: string;
  focus: string;
  difficulty: string;
  estimated_minutes: number;
  exercises: HomeworkExercise[];
  coach_note?: string;
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
  submitted_count?: number;
  approved_count?: number;
  needs_work_count?: number;
};

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
  const [dueDate, setDueDate] = useState(nextDate(7));
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { coach_feedback: string; points_awarded: number }>>({});

  const filteredParticipants = useMemo(() => {
    if (!selectedGroupId) return participants;
    return participants.filter(item => String(item.group_id || '') === selectedGroupId);
  }, [participants, selectedGroupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupsRes, participantsRes, assignmentsRes, submissionsRes] = await Promise.all([
        adminRequest('/api/groups'),
        adminRequest('/api/participants'),
        adminRequest('/api/homework'),
        adminRequest('/api/homework/submissions'),
      ]);
      setGroups(groupsRes.ok ? await groupsRes.json() : []);
      setParticipants(participantsRes.ok ? await participantsRes.json() : []);
      setAssignments(assignmentsRes.ok ? await assignmentsRes.json() : []);
      setSubmissions(submissionsRes.ok ? await submissionsRes.json() : []);
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
      const res = await adminRequest('/api/homework/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus, difficulty, estimated_minutes: minutes }),
      });
      const data = await res.json();
      const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(nextSuggestions);
      setSelectedSuggestion(nextSuggestions[0] || null);
    } catch {
      toast.error('Не вдалося згенерувати ДЗ');
    } finally {
      setIsGenerating(false);
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

  const reviewSubmission = async (submission: HomeworkItem, status: 'approved' | 'needs_work') => {
    if (!submission.id) return;
    const draft = reviewDrafts[submission.id] || { coach_feedback: '', points_awarded: status === 'approved' ? 5 : 0 };
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
      fetchData();
    } catch {
      toast.error('Помилка перевірки');
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
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Складність</span>
              <select value={difficulty} onChange={event => setDifficulty(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none">
                {difficultyOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Хвилин</span>
              <input type="number" min={5} max={60} value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Група</span>
              <select
                value={selectedGroupId}
                onChange={event => {
                  setSelectedGroupId(event.target.value);
                  setSelectedParticipantIds([]);
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
                  <button
                    key={`${suggestion.title}-${index}`}
                    type="button"
                    onClick={() => setSelectedSuggestion(suggestion)}
                    className={`rounded-[2rem] border p-5 text-left transition-all ${selected ? 'border-red-500/40 bg-red-500/10' : 'border-white/5 bg-zinc-900/50 hover:border-white/15'}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-black uppercase text-white">{suggestion.title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{suggestion.description}</p>
                      </div>
                      {selected && <CheckCircle2 className="text-red-400" size={24} />}
                    </div>
                    <ExerciseList exercises={suggestion.exercises} />
                    {suggestion.coach_note && <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100/80">{suggestion.coach_note}</p>}
                  </button>
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
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">на перевірці {item.submitted_count || 0}</div>
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">готово {item.approved_count || 0}</div>
                  <div className="rounded-xl bg-amber-500/10 p-2 text-amber-300">правки {item.needs_work_count || 0}</div>
                </div>
              </div>
            ))}
            {!isLoading && assignments.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Розсилок ще немає</div>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <h3 className="mb-5 text-2xl font-black uppercase text-white">Перевірка щоденників</h3>
          <div className="space-y-4">
            {submissions.slice(0, 12).map(item => {
              const exercises = normalizeExercises(item.exercises);
              const draft = reviewDrafts[item.id || 0] || { coach_feedback: item.coach_feedback || '', points_awarded: item.status === 'approved' ? Number(item.points_awarded || 0) : 5 };
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
                    <button type="button" onClick={() => reviewSubmission(item, 'approved')} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black uppercase text-black">
                      <Award size={16} />
                      Зарахувати
                    </button>
                    <button type="button" onClick={() => reviewSubmission(item, 'needs_work')} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black uppercase text-black">
                      <MessageSquareText size={16} />
                      На правки
                    </button>
                  </div>
                </div>
              );
            })}
            {!isLoading && submissions.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Щоденників ще немає</div>}
          </div>
        </div>
      </section>
    </div>
  );
};

export const HomeworkParentDiary = ({ participantId }: { participantId?: number | null }) => {
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
      if (!expandedId && nextItems[0]?.assignment_participant_id) setExpandedId(nextItems[0].assignment_participant_id);
    } catch {
      toast.error('Не вдалося завантажити домашні завдання');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomework();
  }, [participantId]);

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

  return (
    <div className="space-y-8">
      <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-black uppercase text-red-500">Домашній щоденник</p>
          <h2 className="text-4xl font-black uppercase text-white lg:text-5xl">Домашні завдання</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Тут дитина або батьки відмічають, що зроблено вдома: скільки сетів, повторів, хвилин і що було складно.
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
              <div key={id} className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950">
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
                        <ExerciseList exercises={exercises} />

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
