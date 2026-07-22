import { useState, useMemo } from 'react';

// Categories/urgencies mirror the backend's allowed vocabulary
// (volunteerTaskController CATEGORIES / URGENCIES).
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

// Human labels for the task status values.
const STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const field =
  'w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] ' +
  'bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white ' +
  'focus:outline-none focus:border-[#7F9764] focus:ring-2 focus:ring-[#7F9764]/30 transition-all';
const labelCls = 'block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2';

// A task is fulfillable (can move to in-progress) once its minimum volunteers
// are confirmed and its resources are marked ready. Mirrors the backend gate.
const isFulfillable = (task) =>
  task.volunteersConfirmed >= task.minVolunteers && task.resourcesReady;

const parseSkills = (json) => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Format an ISO date for display (date only, no time).
const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Organization "Tasks" tab. Two columns: on the left, the org's requests
// ("Your Requests"); on the right, a panel scoped to the selected request where
// the org adds help tasks (optionally from AI suggestions) and manages the tasks
// already attached to it. Until a request is selected, the right side shows a
// placeholder.
//
// Every task is attributed to its request; the org sets the min/max number of
// volunteers, marks resources ready, and schedules a volunteer day. A task can
// only move to in-progress once the minimum volunteers are confirmed and
// resources are ready. The volunteer sign-up side isn't built yet, so
// `volunteersConfirmed` is a manual count the org maintains here.
//
// @param {object[]} tasks - all of the org's tasks (each carries its request id)
// @param {object[]} requests - the org's requests ("Your Requests")
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(task) => Promise} onCreate
// @param {(id, updates) => Promise} onUpdate
// @param {(id) => Promise} onDelete
// @param {(id) => Promise<Array>} onSuggestDates
// @param {(requestId) => Promise<Array>} onSuggestTasks
const TasksView = ({
  tasks = [],
  requests = [],
  loading,
  error,
  onRetry,
  onCreate,
  onUpdate,
  onDelete,
  onSuggestDates,
  onSuggestTasks,
}) => {
  // Which request's tasks are shown in the right panel (null = none yet).
  const [selectedId, setSelectedId] = useState(null);

  // How many tasks are attached to each request, for the count chip.
  const taskCounts = useMemo(() => {
    const counts = {};
    for (const t of tasks) {
      counts[t.requestId] = (counts[t.requestId] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  // Tasks belonging to the selected request.
  const selectedTasks = useMemo(
    () => (selectedId ? tasks.filter((t) => t.requestId === selectedId) : []),
    [tasks, selectedId]
  );

  // The selected request itself (looked up fresh so it stays current on reload).
  const selectedRequest = selectedId
    ? requests.find((r) => r.id === selectedId) || null
    : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      {/* Column 1: the org's requests */}
      <div className="bg-white dark:bg-[#16233a] rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white mb-1">
          Your Requests
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Select a request to add volunteer tasks for it.
        </p>

        {loading && (
          <p className="text-[#1C2A16] dark:text-gray-300" role="status">Loading…</p>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
            <p className="font-semibold">{error}</p>
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-semibold underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">
            You aren&apos;t responding to any requests yet. Assign a request to your
            organization from the Requests tab to add tasks for it.
          </p>
        )}

        {!loading && !error && requests.length > 0 && (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const isSelected = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    aria-pressed={isSelected}
                    className={`w-full flex items-center justify-between gap-3 text-left rounded-xl border px-4 py-3 transition-colors ${
                      isSelected
                        ? 'border-[#7F9764] bg-[#eef4e7] dark:bg-[#22304a]'
                        : 'border-gray-200 dark:border-[#2b3b55] hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1C2A16] dark:text-white truncate">
                        {r.category || 'Request'}
                        {r.location ? ` · ${r.location}` : ''}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {r.description || 'No description provided.'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-[#e3ecd9] text-[#3a4a30] dark:bg-[#2b3b22] dark:text-[#c3d4b0]">
                      {taskCounts[r.id] || 0} task{(taskCounts[r.id] || 0) === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Column 2: add a task for the selected request (placeholder until chosen) */}
      <div className="bg-white dark:bg-[#16233a] rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white mb-1">
          Add a Task
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Create a task for the help request.
        </p>
        {selectedRequest ? (
          // Scroll the form within the viewport so the column fits the screen.
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <CreateTaskForm
              requestId={selectedRequest.id}
              onCreate={onCreate}
              onSuggestTasks={onSuggestTasks}
            />
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-[#3a4f30] p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Select a request on the left to add a task for it.
            </p>
          </div>
        )}
      </div>

      {/* Column 3: the selected request's tasks in card view (placeholder until chosen) */}
      <div className="bg-white dark:bg-[#16233a] rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white mb-1">
          Tasks for the Request
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Tasks for the request to be completed by volunteers.
        </p>
        {!selectedRequest ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-[#3a4f30] p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Select a request on the left to see its tasks here.
            </p>
          </div>
        ) : selectedTasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-[#3a4f30] p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No tasks yet. Add one using the form on the left and it will show
              up here.
            </p>
          </div>
        ) : (
          // One card per row; cap the height to about two cards and scroll the
          // rest so at most ~2 cards are on screen at once.
          <ul className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
            {selectedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onSuggestDates={onSuggestDates}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// --- Create form ---

// Adds a task for a fixed help request (`requestId`). The request is chosen in
// the left-hand "Your Requests" list, so there's no picker here.
const CreateTaskForm = ({ requestId, onCreate, onSuggestTasks }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgency, setUrgency] = useState('Medium');
  const [skills, setSkills] = useState('');
  const [minVolunteers, setMinVolunteers] = useState('1');
  const [maxVolunteers, setMaxVolunteers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // AI task suggestions for the selected request.
  const [suggestions, setSuggestions] = useState(null); // null = not loaded
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Prefill the form fields from an AI-suggested (or any) task draft.
  const applyDraft = (draft) => {
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    if (CATEGORIES.includes(draft.category)) setCategory(draft.category);
    if (URGENCIES.includes(draft.urgency)) setUrgency(draft.urgency);
    setSkills(Array.isArray(draft.skillsNeeded) ? draft.skillsNeeded.join(', ') : '');
    setMinVolunteers(String(draft.minVolunteers ?? 1));
    setMaxVolunteers(draft.maxVolunteers == null ? '' : String(draft.maxVolunteers));
  };

  const loadSuggestions = async () => {
    setFormError('');
    setLoadingSuggestions(true);
    try {
      setSuggestions(await onSuggestTasks(requestId));
    } catch (err) {
      setFormError(err.message || 'Could not load task suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !description.trim()) {
      setFormError('Please fill in the title and description.');
      return;
    }
    const min = Number(minVolunteers);
    if (!Number.isInteger(min) || min < 1) {
      setFormError('Minimum volunteers must be a whole number of 1 or more.');
      return;
    }
    if (maxVolunteers !== '') {
      const max = Number(maxVolunteers);
      if (!Number.isInteger(max) || max < min) {
        setFormError('Maximum volunteers must be a whole number no less than the minimum.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onCreate({
        requestId,
        title: title.trim(),
        description: description.trim(),
        category,
        urgency,
        // Split the free-text skills field on commas into a clean array.
        skillsNeeded: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        minVolunteers: min,
        maxVolunteers: maxVolunteers === '' ? null : Number(maxVolunteers),
      });
      // Reset the free-text fields; keep the request/category/urgency selected
      // for quickly posting several tasks against the same request.
      setTitle('');
      setDescription('');
      setSkills('');
      setMinVolunteers('1');
      setMaxVolunteers('');
      setSuggestions(null);
    } catch (err) {
      setFormError(err.message || 'Could not create the task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={loadSuggestions}
          disabled={loadingSuggestions}
          className="text-xs font-semibold text-[#1C2A16] dark:text-[#a9c48c] underline hover:no-underline disabled:opacity-50 disabled:no-underline"
        >
          {loadingSuggestions ? 'Thinking…' : 'Suggest tasks (AI)'}
        </button>
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{formError}</p>
        </div>
      )}

      {/* AI-suggested task drafts for this request */}
      {suggestions && suggestions.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="rounded-lg border border-gray-200 dark:border-[#3a4f30] p-2.5 bg-white dark:bg-[#1a2f1a]"
            >
              <p className="text-sm font-semibold text-[#1C2A16] dark:text-white">{s.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{s.description}</p>
              <button
                type="button"
                onClick={() => applyDraft(s)}
                className="text-xs font-semibold text-white bg-[#1C2A16] dark:bg-[#7F9764] rounded-full px-3 py-1"
              >
                Use this draft
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions && suggestions.length === 0 && (
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          No task suggestions available right now.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="taskTitle" className={labelCls}>Title</label>
          <input
            type="text"
            id="taskTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sandbag the riverfront"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="taskDescription" className={labelCls}>Description</label>
          <textarea
            id="taskDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What volunteers will be doing, where, and any details."
            rows={3}
            className={field}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="taskCategory" className={labelCls}>Category</label>
            <select
              id="taskCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="taskUrgency" className={labelCls}>Urgency</label>
            <select
              id="taskUrgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className={field}
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="taskSkills" className={labelCls}>
            Skills needed <span className="font-normal text-gray-500">(comma-separated)</span>
          </label>
          <input
            type="text"
            id="taskSkills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. medical, logistics, translation"
            className={field}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="taskMin" className={labelCls}>Min volunteers</label>
            <input
              type="number"
              id="taskMin"
              min="1"
              step="1"
              value={minVolunteers}
              onChange={(e) => setMinVolunteers(e.target.value)}
              className={field}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="taskMax" className={labelCls}>
              Max <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              type="number"
              id="taskMax"
              min="1"
              step="1"
              value={maxVolunteers}
              onChange={(e) => setMaxVolunteers(e.target.value)}
              placeholder="No cap"
              className={field}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? 'Posting…' : 'Post Task'}
        </button>
      </form>
    </div>
  );
};

// --- Task card ---

const TaskCard = ({ task, onUpdate, onDelete, onSuggestDates }) => {
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const [suggestions, setSuggestions] = useState(null); // null = not loaded yet
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const skills = parseSkills(task.skillsNeeded);
  const fulfillable = isFulfillable(task);
  const minMet = task.volunteersConfirmed >= task.minVolunteers;
  const atMax = task.maxVolunteers != null && task.volunteersConfirmed >= task.maxVolunteers;
  const scheduledDate = formatDate(task.volunteerDate);

  // Wrap a mutating call so the card shows a busy state and surfaces errors.
  const run = async (fn) => {
    setBusy(true);
    setCardError('');
    try {
      await fn();
    } catch (err) {
      setCardError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const changeVolunteers = (delta) => {
    const next = Math.max(0, task.volunteersConfirmed + delta);
    // Don't let the manual count exceed the max, if one is set.
    if (task.maxVolunteers != null && next > task.maxVolunteers) return;
    run(() => onUpdate(task.id, { volunteersConfirmed: next }));
  };

  const loadSuggestions = () =>
    run(async () => {
      setLoadingSuggestions(true);
      try {
        setSuggestions(await onSuggestDates(task.id));
      } finally {
        setLoadingSuggestions(false);
      }
    });

  const pickDate = (isoDate) =>
    run(async () => {
      await onUpdate(task.id, { volunteerDate: isoDate });
      setSuggestions(null);
    });

  const statusPillCls =
    {
      open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      'in-progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    }[task.status] || 'bg-gray-200 text-gray-600';

  return (
    <li className="rounded-xl border border-gray-200 dark:border-[#2b3b55] p-4">
      {/* Header: title + status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-[#1C2A16] dark:text-white">{task.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {task.category || 'Uncategorized'} · {task.urgency} urgency
          </p>
        </div>
        <span className={`text-xs font-semibold uppercase px-3 py-1.5 rounded-full shrink-0 ${statusPillCls}`}>
          {STATUS_LABELS[task.status] || task.status}
        </span>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{task.description}</p>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {skills.map((s) => (
            <span
              key={s}
              className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#e3ecd9] text-[#3a4a30] dark:bg-[#2b3b22] dark:text-[#c3d4b0]"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Volunteer count with manual +/- (stand-in for volunteer sign-up) */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-[#1a2f1a] px-3 py-2 mb-2">
        <div className="text-sm">
          <span className="font-semibold text-[#1C2A16] dark:text-white">
            {task.volunteersConfirmed}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {' '}/ {task.minVolunteers} min
            {task.maxVolunteers != null ? ` · ${task.maxVolunteers} max` : ''} volunteers
          </span>
          {minMet ? (
            <span className="ml-2 text-green-700 dark:text-green-400 font-semibold">✓ min met</span>
          ) : (
            <span className="ml-2 text-amber-700 dark:text-amber-400">needs {task.minVolunteers - task.volunteersConfirmed} more</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => changeVolunteers(-1)}
            disabled={busy || task.volunteersConfirmed === 0}
            aria-label="Remove a volunteer"
            className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => changeVolunteers(1)}
            disabled={busy || atMax}
            aria-label="Add a volunteer"
            className="w-7 h-7 rounded-full bg-[#1C2A16] dark:bg-[#7F9764] text-white font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Resources-ready toggle */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-[#1a2f1a] px-3 py-2 mb-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">Necessary resources ready</span>
        <button
          type="button"
          onClick={() => run(() => onUpdate(task.id, { resourcesReady: !task.resourcesReady }))}
          disabled={busy}
          aria-pressed={task.resourcesReady}
          className={`text-xs font-semibold uppercase px-3 py-1.5 rounded-full disabled:opacity-50 ${
            task.resourcesReady
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {task.resourcesReady ? 'Ready' : 'Not ready'}
        </button>
      </div>

      {/* Volunteer day: scheduled date + AI suggestions */}
      <div className="rounded-lg bg-gray-50 dark:bg-[#1a2f1a] px-3 py-2 mb-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Volunteer day:{' '}
            <span className="font-semibold text-[#1C2A16] dark:text-white">
              {scheduledDate || 'not set'}
            </span>
          </span>
          <button
            type="button"
            onClick={loadSuggestions}
            disabled={busy || loadingSuggestions}
            className="text-xs font-semibold text-[#1C2A16] dark:text-[#a9c48c] underline hover:no-underline disabled:opacity-50"
          >
            {loadingSuggestions ? 'Thinking…' : 'Suggest dates (AI)'}
          </button>
        </div>

        {suggestions && suggestions.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li key={s.date} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <span className="font-semibold text-[#1C2A16] dark:text-white">
                    {formatDate(s.date)}
                  </span>
                  {s.reason && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{s.reason}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => pickDate(s.date)}
                  disabled={busy}
                  className="shrink-0 text-xs font-semibold text-white bg-[#1C2A16] dark:bg-[#7F9764] rounded-full px-3 py-1 disabled:opacity-50"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        )}
        {suggestions && suggestions.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            No date suggestions available right now.
          </p>
        )}
      </div>

      {cardError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{cardError}</p>
      )}

      {/* Status actions */}
      <div className="flex flex-wrap items-center gap-2">
        {task.status === 'open' && (
          <button
            type="button"
            onClick={() => run(() => onUpdate(task.id, { status: 'in-progress' }))}
            disabled={busy || !fulfillable}
            title={
              fulfillable
                ? 'Mark this task in progress'
                : 'Confirm the minimum volunteers and mark resources ready first'
            }
            className="text-sm font-semibold text-white bg-[#1C2A16] dark:bg-[#7F9764] rounded-full px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Set in progress
          </button>
        )}
        {task.status === 'in-progress' && (
          <button
            type="button"
            onClick={() => run(() => onUpdate(task.id, { status: 'completed' }))}
            disabled={busy}
            className="text-sm font-semibold text-white bg-green-700 rounded-full px-4 py-1.5 disabled:opacity-50"
          >
            Mark completed
          </button>
        )}
        {!fulfillable && task.status === 'open' && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Auto-starts 2 days after the minimum volunteers and resources are ready.
          </span>
        )}
        <button
          type="button"
          onClick={() => run(() => onDelete(task.id))}
          disabled={busy}
          className="ml-auto text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
};

export default TasksView;
