import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../src/utils/api';
import './HelpRequestForm.css';

// Compact, theme-coherent help request form.
// - `compact` trims padding/spacing so it fits a dashboard column.
// - `onCreated` (optional) fires after a successful create so a parent
//   (e.g. the dashboard) can refresh its "My Requests" list.
// - `request` (optional) puts the form in edit mode: fields pre-fill from it
//   and submitting PATCHes that request instead of creating a new one.
// - `onSaved` (optional) fires after a successful edit with the updated request.
// The categories a help-seeker can request help with, and the urgency levels
// each can be tagged with. Kept here so the checkboxes and dropdowns stay in
// sync with the backend's accepted values.
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

const HelpRequestForm = ({ compact = false, onCreated, onSaved, onClose, request }) => {
  const { t } = useTranslation();
  const isEditing = Boolean(request);
  const [formData, setFormData] = useState({
    submitterName: '',
    // Only used in edit mode (a single existing request). Create mode uses
    // `selections` below so several categories can be requested at once.
    category: request?.category || '',
    urgency: request?.urgency || '',
    location: request?.location || '',
    description: request?.description || '',
    // Store as a string for the input; blank means "not provided".
    householdSize:
      request?.householdSize != null ? String(request.householdSize) : '',
  });
  // Create mode: which categories are selected, each mapped to its own urgency.
  // e.g. { Food: 'High', Medical: 'Critical' }. A category is selected iff it
  // has a key here. Edit mode ignores this and uses formData.category/urgency.
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // Toggle a category on/off. Turning it on defaults its urgency to 'Medium';
  // turning it off removes it entirely.
  const toggleCategory = (cat) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (cat in next) {
        delete next[cat];
      } else {
        next[cat] = 'Medium';
      }
      return next;
    });
    setError('');
  };

  // Change the urgency for an already-selected category.
  const setCategoryUrgency = (cat, urgency) => {
    setSelections((prev) => ({ ...prev, [cat]: urgency }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Shared fields are required in both modes.
    if (!formData.location || !formData.description || !formData.householdSize) {
      setError(t('requestForm.errorRequired'));
      setLoading(false);
      return;
    }
    // Create mode needs at least one selected category; edit mode still needs
    // its single category + urgency.
    const selected = Object.keys(selections);
    if (isEditing) {
      if (!formData.category || !formData.urgency) {
        setError(t('requestForm.errorRequired'));
        setLoading(false);
        return;
      }
    } else if (selected.length === 0) {
      setError(t('requestForm.errorRequired'));
      setLoading(false);
      return;
    }

    try {
      // api sends the saved token, so the request is linked to this user.
      if (isEditing) {
        const { data } = await api.patch(`/api/requests/${request.id}`, formData);
        if (data.success) {
          setSuccess(true);
          onSaved?.(data.data);   // let the dashboard refresh its list
        }
      } else {
        // Turn the selections into the { category, urgency } pairs the backend
        // expects; every request shares the location/description/household.
        const payload = {
          location: formData.location,
          description: formData.description,
          householdSize: formData.householdSize,
          categories: selected.map((category) => ({
            category,
            urgency: selections[category],
          })),
        };
        const { data } = await api.post('/api/requests', payload);
        if (data.success) {
          setSuccess(true);
          setFormData({ submitterName: '', category: '', urgency: '', location: '', description: '', householdSize: '' });
          setSelections({});
          onCreated?.(data.data);   // let the dashboard refresh its list
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || t('voice.review.errors.submitRetry'));
    } finally {
      setLoading(false);
    }
  };

  // Shared input styling — sage focus ring + dark mode, matching the project.
  const field =
    'w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] ' +
    'bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white ' +
    'focus:outline-none focus:border-[#7F9764] focus:ring-2 focus:ring-[#7F9764]/30 transition-all';
  const label = 'block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2';

  return (
    <div className="help-request-form-wrapper">
    <div className={`relative bg-white dark:bg-[#273A20] rounded-2xl shadow-md transition-colors duration-300 ${compact ? 'p-6' : 'p-8'}`}>
      {/* Close button lives inside the card header so it's always visible and
          can't be clipped by the modal wrapper. Only shown when a parent passes
          onClose (i.e. when rendered in the dashboard modal). */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-3 right-3 w-9 h-9 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 text-2xl leading-none flex items-center justify-center transition-colors"
        >
          ×
        </button>
      )}
      <h2 className={`font-bold text-black dark:text-white mb-1 pr-10 ${compact ? 'text-xl' : 'text-2xl'}`}>
        {isEditing ? t('requestForm.titleEdit') : t('requestForm.titleCreate')}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">
        {isEditing
          ? t('requestForm.subtitleEdit')
          : t('requestForm.subtitleCreate')}
      </p>

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
          <p className="text-green-800 dark:text-green-300 text-sm font-medium">
            {isEditing ? t('requestForm.successEdit') : t('requestForm.successCreate')}
          </p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {isEditing ? (
          <>
            <div>
              <label htmlFor="category" className={label}>{t('voice.review.fields.category')} <span className="text-[#c84444]">*</span></label>
              <select id="category" name="category" value={formData.category} onChange={handleChange} required className={field}>
                <option value="">{t('voice.review.category.placeholder')}</option>
                <option value="Food">{t('voice.review.category.food')}</option>
                <option value="Shelter">{t('voice.review.category.shelter')}</option>
                <option value="Medical">{t('voice.review.category.medical')}</option>
                <option value="Transport">{t('voice.review.category.transport')}</option>
                <option value="Other">{t('voice.review.category.other')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="urgency" className={label}>{t('voice.review.fields.urgency')} <span className="text-[#c84444]">*</span></label>
              <select id="urgency" name="urgency" value={formData.urgency} onChange={handleChange} required className={field}>
                <option value="">{t('voice.review.urgency.placeholder')}</option>
                <option value="Low">{t('voice.review.urgency.low')}</option>
                <option value="Medium">{t('voice.review.urgency.medium')}</option>
                <option value="High">{t('voice.review.urgency.high')}</option>
                <option value="Critical">{t('voice.review.urgency.critical')}</option>
              </select>
            </div>
          </>
        ) : (
          /* Create mode: pick one OR MORE categories, each with its own urgency.
             Every checked category becomes its own help request on submit. */
          <div>
            <span className={label}>{t('voice.review.fields.category')} <span className="text-[#c84444]">*</span></span>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const checked = cat in selections;
                return (
                  <div
                    key={cat}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors ${
                      checked
                        ? 'border-[#7F9764] bg-[#7F9764]/5'
                        : 'border-gray-300 dark:border-[#3a4f30]'
                    }`}
                  >
                    <label className="flex items-center gap-2 flex-1 cursor-pointer text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                        className="w-4 h-4 accent-[#7F9764]"
                      />
                      {t(`voice.review.category.${cat.toLowerCase()}`)}
                    </label>
                    {/* Urgency is always visible so it's clear each category
                        can be prioritized, but it's disabled until the category
                        is checked (an unchecked category isn't being requested,
                        so its urgency doesn't apply yet). */}
                    <select
                      aria-label={`${cat} ${t('voice.review.fields.urgency')}`}
                      value={selections[cat] ?? 'Medium'}
                      onChange={(e) => setCategoryUrgency(cat, e.target.value)}
                      disabled={!checked}
                      className="px-3 py-1.5 rounded-lg border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7F9764] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {URGENCIES.map((u) => (
                        <option key={u} value={u}>
                          {t(`voice.review.urgency.${u.toLowerCase()}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="location" className={label}>{t('voice.review.fields.location')} <span className="text-[#c84444]">*</span></label>
          <input type="text" id="location" name="location" value={formData.location} onChange={handleChange}
            placeholder={t('voice.review.placeholders.location')} required className={field} />
        </div>

        <div>
          <label htmlFor="householdSize" className={label}>{t('voice.review.fields.householdSize')} <span className="text-[#c84444]">*</span></label>
          <input type="number" id="householdSize" name="householdSize" min="1" step="1"
            value={formData.householdSize} onChange={handleChange}
            placeholder={t('voice.review.placeholders.householdSize')} required className={field} />
        </div>

        <div>
          <label htmlFor="description" className={label}>{t('voice.review.fields.description')} <span className="text-[#c84444]">*</span></label>
          <textarea id="description" name="description" value={formData.description} onChange={handleChange}
            placeholder={t('voice.review.placeholders.description')} required rows={compact ? 3 : 4} className={field} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full mt-2 bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3.5 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed">
          {loading
            ? (isEditing ? t('settings.saving') : t('voice.review.submitting'))
            : (isEditing ? t('settings.saveChanges') : t('voice.review.submit'))}
        </button>
      </form>
    </div>
    </div>
  );
};

export default HelpRequestForm;
