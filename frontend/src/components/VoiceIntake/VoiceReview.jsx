import { useState } from 'react';
import api from '../../utils/api';

// "Confirm what we heard" review step (issue #156).
//
// After VoiceIntake transcribes a recording, this shows the fields Claude
// extracted so the user can correct anything before submitting. Fields the AI
// was unsure about (low confidence) are highlighted with a "double-check" hint,
// since those are the most likely to be wrong. Submitting posts to
// POST /api/requests exactly like the manual HelpRequestForm.
//
// @param {{transcript: string, fields: object}} result - from VoiceIntake
// @param {(request: object) => void} [onSubmitted] - fires after a successful create
// @param {() => void} [onBack] - go back to re-record

// Below this confidence, we nudge the user to double-check the field.
const LOW_CONFIDENCE = 0.6;

const VoiceReview = ({ result, onSubmitted, onBack }) => {
  const { transcript = '', fields = {} } = result || {};
  const confidence = fields.confidence || {};

  const [formData, setFormData] = useState({
    category: fields.category || '',
    urgency: fields.urgency || '',
    location: fields.location || '',
    description: fields.description || '',
    // Numeric input wants a string; blank means "not provided".
    householdSize: fields.householdSize != null ? String(fields.householdSize) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.category || !formData.urgency || !formData.location || !formData.description || !formData.householdSize) {
      setError('Please fill in all required fields before submitting.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/requests', formData);
      if (data.success) {
        onSubmitted?.(data.data);
      } else {
        setError(data.message || 'Could not submit your request.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] ' +
    'bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white ' +
    'focus:outline-none focus:border-[#7F9764] focus:ring-2 focus:ring-[#7F9764]/30 transition-all';
  const label = 'block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2';

  // A small amber hint shown under fields the AI wasn't confident about.
  const lowConfidence = (name) =>
    typeof confidence[name] === 'number' && confidence[name] < LOW_CONFIDENCE;

  const DoubleCheck = ({ name }) =>
    lowConfidence(name) ? (
      <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">
        ⚠ Please double-check
      </span>
    ) : null;

  return (
    <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-6 transition-colors duration-300">
      <h2 className="text-xl font-bold text-black dark:text-white mb-1">Confirm What We Heard</h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
        We turned your recording into a request. Review the details and fix anything that's off before submitting.
      </p>

      {/* What the caller actually said, so they can sanity-check the extraction. */}
      {transcript && (
        <div className="mb-5 p-3 bg-gray-50 dark:bg-[#1a2f1a] border border-gray-200 dark:border-[#3a4f30] rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            You said
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 italic">“{transcript}”</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="v-category" className={label}>
            Category <span className="text-[#c84444]">*</span>
            <DoubleCheck name="category" />
          </label>
          <select id="v-category" name="category" value={formData.category} onChange={handleChange} required className={field}>
            <option value="">Select a category</option>
            <option value="Food">Food</option>
            <option value="Shelter">Shelter</option>
            <option value="Medical">Medical</option>
            <option value="Transport">Transportation</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="v-urgency" className={label}>
            Urgency <span className="text-[#c84444]">*</span>
            <DoubleCheck name="urgency" />
          </label>
          <select id="v-urgency" name="urgency" value={formData.urgency} onChange={handleChange} required className={field}>
            <option value="">Select urgency level</option>
            <option value="Low">Low — Can wait a few days</option>
            <option value="Medium">Medium — Within 24 hours</option>
            <option value="High">High — Within a few hours</option>
            <option value="Critical">Critical — Immediate</option>
          </select>
        </div>

        <div>
          <label htmlFor="v-location" className={label}>
            Location <span className="text-[#c84444]">*</span>
            <DoubleCheck name="location" />
          </label>
          <input type="text" id="v-location" name="location" value={formData.location} onChange={handleChange}
            placeholder="City, zip code, or address" required className={field} />
        </div>

        <div>
          <label htmlFor="v-householdSize" className={label}>
            People in Household <span className="text-[#c84444]">*</span>
            <DoubleCheck name="householdSize" />
          </label>
          <input type="number" id="v-householdSize" name="householdSize" min="1" step="1"
            value={formData.householdSize} onChange={handleChange}
            placeholder="How many people need help?" required className={field} />
        </div>

        <div>
          <label htmlFor="v-description" className={label}>
            Description <span className="text-[#c84444]">*</span>
            <DoubleCheck name="description" />
          </label>
          <textarea id="v-description" name="description" value={formData.description} onChange={handleChange}
            placeholder="Describe what help you need..." required rows={4} className={field} />
        </div>

        <div className="flex gap-3">
          {onBack && (
            <button type="button" onClick={onBack} disabled={loading}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide border-2 border-gray-300 dark:border-[#3a4f30] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1a2f1a] disabled:opacity-50 transition-colors">
              Re-record
            </button>
          )}
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3.5 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed">
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VoiceReview;
