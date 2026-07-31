import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Availability view for a volunteer. Shows a weekly grid of days (Mon–Sun) with
// time-of-day slots (morning / afternoon / evening) the volunteer can toggle on
// or off, so organizations know when they can be scheduled. Saving persists the
// whole grid to the volunteer's profile.
//
// Availability is modelled as an object mapping each weekday to the slots the
// volunteer is free: { monday: ['morning', 'evening'], ... }. Days with no
// selected slots are simply omitted.
//
// @param {Record<string, string[]>} availability - the saved availability
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(availability) => Promise<void>} onSave - persist the edited grid
// @param {boolean} saving - true while a save is in flight
const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const SLOTS = ['morning', 'afternoon', 'evening'];

const VolunteerAvailabilityView = ({ availability, loading, error, onRetry, onSave, saving }) => {
  const { t } = useTranslation();
  // Local working copy so edits feel instant; seeded from props and re-seeded
  // whenever the saved availability changes (e.g. after a reload).
  const [draft, setDraft] = useState(availability || {});
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(availability || {});
  }, [availability]);

  const isOn = (day, slot) => (draft[day] || []).includes(slot);

  // Toggle a single day/slot cell, keeping each day's slot list in canonical
  // order and dropping the day entirely once it has no slots left.
  const toggle = (day, slot) => {
    setSaved(false);
    setDraft((prev) => {
      const current = prev[day] || [];
      const nextSlots = current.includes(slot)
        ? current.filter((s) => s !== slot)
        : SLOTS.filter((s) => s === slot || current.includes(s));
      const next = { ...prev };
      if (nextSlots.length) next[day] = nextSlots;
      else delete next[day];
      return next;
    });
  };

  const clearAll = () => {
    setSaved(false);
    setDraft({});
  };

  const handleSave = async () => {
    setSaveError('');
    setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message || t('volunteer.availability.saveError'));
    }
  };

  if (loading) {
    return <p className="text-[#1C2A16] dark:text-gray-300" role="status">{t('volunteer.common.loading')}</p>;
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4">
        <p className="font-semibold">{error}</p>
        <button onClick={onRetry} className="mt-2 text-sm font-semibold underline hover:no-underline">
          {t('volunteer.common.tryAgain')}
        </button>
      </div>
    );
  }

  const hasAny = DAYS.some((day) => (draft[day] || []).length > 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="bg-white dark:bg-[#16233a] rounded-3xl p-6 sm:p-8 shadow-md flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white">{t('volunteer.availability.yourAvailability')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('volunteer.availability.help')}
          </p>
        </div>

        {/* Weekly grid: one row per day, one toggle per time-of-day slot. */}
        <div className="flex flex-col gap-3">
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
            >
              <span className="font-semibold text-[#1C2A16] dark:text-white w-28 shrink-0">
                {t(`volunteer.availability.days.${day}`)}
              </span>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((slot) => {
                  const on = isOn(day, slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggle(day, slot)}
                      aria-pressed={on}
                      className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                        on
                          ? 'border-[#6ba3d3] bg-[#6ba3d3] text-white'
                          : 'border-gray-300 text-gray-700 dark:text-gray-200 hover:border-[#6ba3d3]'
                      }`}
                    >
                      {t(`volunteer.availability.slots.${slot}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {hasAny && (
          <div>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-semibold text-gray-500 hover:text-[#c84444] underline hover:no-underline"
            >
              {t('volunteer.availability.clearAll')}
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <p role="alert" className="text-sm font-medium text-red-600">{saveError}</p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-green-700">{t('volunteer.availability.availabilitySaved')}</p>
      )}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#6ba3d3] text-white font-bold hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('volunteer.common.saving') : t('volunteer.availability.saveAvailability')}
        </button>
      </div>
    </div>
  );
};

export default VolunteerAvailabilityView;
