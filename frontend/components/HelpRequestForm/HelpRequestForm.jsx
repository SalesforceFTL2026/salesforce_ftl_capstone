import { useState } from 'react';
import api from '../../src/utils/api';

// Compact, theme-coherent help request form.
// - `compact` trims padding/spacing so it fits a dashboard column.
// - `onCreated` (optional) fires after a successful submit so a parent
//   (e.g. the dashboard) can refresh its "My Requests" list.
const HelpRequestForm = ({ compact = false, onCreated }) => {
  const [formData, setFormData] = useState({
    submitterName: '',
    category: '',
    urgency: '',
    location: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!formData.category || !formData.urgency || !formData.location || !formData.description) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      // api sends the saved token, so the request is linked to this user.
      const { data } = await api.post('/api/requests', formData);
      if (data.success) {
        setSuccess(true);
        setFormData({ submitterName: '', category: '', urgency: '', location: '', description: '' });
        onCreated?.(data.data);   // let the dashboard refresh its list
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Shared input styling — sage focus ring + dark mode, matching the project.
  const field =
    'w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] ' +
    'bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white ' +
    'focus:outline-none focus:border-[#7F9764] focus:ring-2 focus:ring-[#7F9764]/30 transition-all';
  const label = 'block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2';

  return (
    <div className={`bg-white dark:bg-[#273A20] rounded-2xl shadow-md transition-colors duration-300 ${compact ? 'p-6' : 'p-8'}`}>
      <h2 className={`font-bold text-black dark:text-white mb-1 ${compact ? 'text-xl' : 'text-2xl'}`}>
        Request Help
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">
        Tell us what you need and we'll prioritize it.
      </p>

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
          <p className="text-green-800 dark:text-green-300 text-sm font-medium">✓ Request submitted!</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="category" className={label}>Category <span className="text-[#c84444]">*</span></label>
          <select id="category" name="category" value={formData.category} onChange={handleChange} required className={field}>
            <option value="">Select a category</option>
            <option value="Food">Food</option>
            <option value="Shelter">Shelter</option>
            <option value="Medical">Medical</option>
            <option value="Transport">Transportation</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="urgency" className={label}>Urgency <span className="text-[#c84444]">*</span></label>
          <select id="urgency" name="urgency" value={formData.urgency} onChange={handleChange} required className={field}>
            <option value="">Select urgency level</option>
            <option value="Low">Low — Can wait a few days</option>
            <option value="Medium">Medium — Within 24 hours</option>
            <option value="High">High — Within a few hours</option>
            <option value="Critical">Critical — Immediate</option>
          </select>
        </div>

        <div>
          <label htmlFor="location" className={label}>Location <span className="text-[#c84444]">*</span></label>
          <input type="text" id="location" name="location" value={formData.location} onChange={handleChange}
            placeholder="City, zip code, or address" required className={field} />
        </div>

        <div>
          <label htmlFor="description" className={label}>Description <span className="text-[#c84444]">*</span></label>
          <textarea id="description" name="description" value={formData.description} onChange={handleChange}
            placeholder="Describe what help you need..." required rows={compact ? 3 : 4} className={field} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed">
          {loading ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
};

export default HelpRequestForm;
