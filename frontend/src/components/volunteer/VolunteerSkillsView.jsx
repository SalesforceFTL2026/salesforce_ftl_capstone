import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DISASTER_SKILLS } from '../../utils/skills';

// Skills view for a volunteer. Lists the skills they gave at signup (each with a
// self-rated 1–5 proficiency), lets them adjust each rating, add more skills
// (from the canonical list or free-form), and remove skills. Saving persists the
// whole set to the volunteer's profile.
//
// @param {{name: string, level: number}[]} skills - the saved skills
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(skills) => Promise<void>} onSave - persist the edited skills
// @param {boolean} saving - true while a save is in flight
const LEVEL_KEYS = ['novice', 'beginner', 'competent', 'proficient', 'expert'];

const VolunteerSkillsView = ({ skills, loading, error, onRetry, onSave, saving }) => {
  const { t } = useTranslation();
  // Local working copy so edits feel instant; seeded from props and re-seeded
  // whenever the saved skills change (e.g. after a reload).
  const [draft, setDraft] = useState(skills);
  const [addValue, setAddValue] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(skills);
  }, [skills]);

  const setLevel = (name, level) =>
    setDraft((prev) => prev.map((s) => (s.name === name ? { ...s, level } : s)));

  const removeSkill = (name) =>
    setDraft((prev) => prev.filter((s) => s.name !== name));

  const addSkill = (rawName) => {
    const name = rawName.trim();
    if (!name) return;
    // Ignore duplicates (case-insensitive).
    if (draft.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setAddValue('');
      return;
    }
    setDraft((prev) => [...prev, { name, level: 3 }]);
    setAddValue('');
  };

  const handleSave = async () => {
    setSaveError('');
    setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message || t('volunteer.skills.saveError'));
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

  // Canonical skills the volunteer hasn't added yet, offered as quick-add chips.
  const remaining = DISASTER_SKILLS.filter(
    (skill) => !draft.some((s) => s.name.toLowerCase() === skill.toLowerCase())
  );

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div className="bg-white dark:bg-[#16233a] rounded-3xl p-6 sm:p-8 shadow-md flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white">{t('volunteer.skills.yourSkills')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('volunteer.skills.rateHelp')}
          </p>
        </div>

        {draft.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t('volunteer.skills.noSkillsYet')}
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {draft.map((skill) => (
              <li key={skill.name} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#1C2A16] dark:text-white">
                    {skill.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#6ba3d3] w-24 text-right">
                      {skill.level} · {t(`volunteer.skills.levels.${LEVEL_KEYS[skill.level - 1]}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill.name)}
                      aria-label={t('volunteer.skills.removeSkill', { name: skill.name })}
                      className="text-gray-400 hover:text-[#c84444] text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={skill.level}
                  onChange={(e) => setLevel(skill.name, Number(e.target.value))}
                  className="w-full accent-[#6ba3d3]"
                  aria-label={t('volunteer.skills.proficiencyFor', { name: skill.name })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add a skill: quick-add chips from the canonical list + free-form entry. */}
      <div className="bg-white dark:bg-[#16233a] rounded-3xl p-6 sm:p-8 shadow-md flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#1C2A16] dark:text-white">{t('volunteer.skills.addASkill')}</h3>

        {remaining.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {remaining.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSkill(skill)}
                className="px-3 py-2 rounded-full border-2 border-gray-300 text-gray-700 dark:text-gray-200 text-sm font-medium hover:border-[#6ba3d3] transition-colors"
              >
                + {skill}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); addSkill(addValue); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            placeholder={t('volunteer.skills.addAnotherPlaceholder')}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all dark:bg-[#1f2d18] dark:text-white"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-[#1f2d18] text-[#1C2A16] dark:text-white font-semibold hover:bg-gray-200 transition-colors"
          >
            {t('volunteer.skills.add')}
          </button>
        </form>
      </div>

      {saveError && (
        <p role="alert" className="text-sm font-medium text-red-600">{saveError}</p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-green-700">{t('volunteer.skills.skillsSaved')}</p>
      )}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#6ba3d3] text-white font-bold hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('volunteer.common.saving') : t('volunteer.skills.saveSkills')}
        </button>
      </div>
    </div>
  );
};

export default VolunteerSkillsView;
