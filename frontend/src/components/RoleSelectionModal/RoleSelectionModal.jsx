import { useState } from 'react';
import { signup, authErrorMessage } from '../../utils/auth';

// New-user registration form. Opened when someone picks a role on the landing
// page (help-seeker / volunteer / organization). The role is passed in, so it
// is never chosen here — it comes straight from the button the user clicked.
//
// On submit it registers the user, signs them in (see signup()), and reports
// the logged-in user back to the parent via onSubmit.
//
// @param {string} role - the role the user picked ('help-seeker' | 'volunteer' | 'organization')
// @param {() => void} onClose - close the modal without registering
// @param {(user: object) => void} onSubmit - called with the signed-in user on success
const RoleSelectionModal = ({ role, embedded = false, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleLabels = {
    'help-seeker': 'Help Seeker',
    'volunteer': 'Volunteer',
    'organization': 'Organization'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Match the backend's rules so users get feedback before we call the API.
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      // signup() registers the user, logs them in, and returns the user.
      const user = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        location: location.trim(),
      });
      onSubmit?.(user);
    } catch (err) {
      // Prefer the server's message; never surface a raw stack trace.
      setError(authErrorMessage(err, 'Unable to sign up right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="At least 8 characters"
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

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}

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
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Continue'}
            </button>
          </div>
    </form>
  );

  // Embedded inside AuthModal: it provides the popup shell + title/tabs.
  if (embedded) return formBody;

  // Standalone: render our own popup shell + title.
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
        {formBody}
      </div>
    </div>
  );
};

export default RoleSelectionModal;
