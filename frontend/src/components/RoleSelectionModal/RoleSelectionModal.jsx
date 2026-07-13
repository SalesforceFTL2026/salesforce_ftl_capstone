import { useState } from 'react';

function RoleSelectionModal({ role, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const roleLabels = {
    'help-seeker': 'Help Seeker',
    'volunteer': 'Volunteer',
    'organization': 'Organization'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({ role, name: name.trim(), location: location.trim() });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-10 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-3xl font-bold text-black">
            Welcome, {roleLabels[role]}!
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none -mt-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Location <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="City, State or Zip Code"
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-400 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase text-sm tracking-wide"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#6ba3d3] text-white font-bold rounded-xl hover:bg-[#5a92c2] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed uppercase text-sm tracking-wide"
              disabled={!name.trim()}
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RoleSelectionModal;
