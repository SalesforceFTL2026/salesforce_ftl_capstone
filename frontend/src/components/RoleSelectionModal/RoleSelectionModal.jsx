import { useState } from 'react';
import { signup, authErrorMessage } from '../../utils/auth';
import { DISASTER_SKILLS } from '../../utils/skills';

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
  const [showPassword, setShowPassword] = useState(false);
  const [location, setLocation] = useState('');
  // Skills only apply to volunteers; ignored for other roles.
  const [skills, setSkills] = useState([]);
  // The skills list is long, so keep it collapsed until the user opens it.
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isVolunteer = role === 'volunteer';

  const roleLabels = {
    'help-seeker': 'Help Seeker',
    'volunteer': 'Volunteer',
    'organization': 'Organization'
  };

  // Toggle a skill in/out of the selected list.
  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Match the backend's rules so users get feedback before we call the API.
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email, and password are required.');
      return;
    }
    if (!location.trim()) {
      setError('Location is required.');
      return;
    }
    // Mirror the backend policy so users get feedback before we call the API.
    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (password.length > 72) {
      setError('Password must be 72 characters or fewer.');
      return;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must include an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    // Volunteers must pick at least one skill (mirrors the backend policy).
    if (isVolunteer && skills.length === 0) {
      setSkillsOpen(true); // reveal the picker so they can act on the error
      setError('Please select at least one skill you can help with.');
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
        skills: isVolunteer ? skills : [],
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-16 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
                placeholder="12+ chars, with a capital & number"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-4 flex items-center text-sm font-medium text-[#6ba3d3]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="City, State or Zip Code"
              required
            />
          </div>

          {/* Volunteers pick the disaster-response skills they can offer. These
              seed their profile and feed the dashboard's "My Interests" view. */}
          {isVolunteer && (
            <div>
              <button
                type="button"
                onClick={() => setSkillsOpen((v) => !v)}
                aria-expanded={skillsOpen}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="block text-sm font-bold text-gray-800 uppercase tracking-wide">
                  Skills <span className="text-red-500">*</span>
                  <span className="ml-2 text-gray-400 text-xs font-normal normal-case tracking-normal">
                    {skills.length > 0
                      ? `${skills.length} selected`
                      : 'Select all that apply'}
                  </span>
                </span>
                {/* Chevron rotates to point down when the section is open. */}
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform ${skillsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {skillsOpen && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {DISASTER_SKILLS.map((skill) => {
                    const selected = skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        aria-pressed={selected}
                        className={`px-3 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-[#6ba3d3] border-[#6ba3d3] text-white'
                            : 'bg-transparent border-gray-300 text-gray-700 hover:border-[#6ba3d3]'
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
    >
      {/* Stop clicks inside the modal from bubbling up to the backdrop's close. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-10 max-w-lg w-full shadow-2xl max-h-full overflow-y-auto"
      >
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
