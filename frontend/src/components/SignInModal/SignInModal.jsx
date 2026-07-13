import { useState } from 'react';
import { login, authErrorMessage } from '../../utils/auth';

// A single sign-in form used by every role (help-seeker, volunteer,
// organization). Authentication is identical for everyone — the only thing
// that differs is where the user lands afterward, and that is decided by the
// role the server returns, not chosen here.
//
// @param {() => void} onClose - close the modal without signing in
// @param {(user: object) => void} onSuccess - called with the signed-in user
//   on success; the parent decides where to route them (see pathForRole).
const SignInModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // login() authenticates, stores the token, and returns the user.
      const user = await login({ email: email.trim(), password });
      onSuccess?.(user);
    } catch (err) {
      // Prefer the server's message; never surface a raw stack trace.
      setError(authErrorMessage(err, 'Unable to sign in right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-10 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-3xl font-bold text-black">Welcome back</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none -mt-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label
              htmlFor="signin-email"
              className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="signin-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="signin-password"
              className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="signin-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/20 transition-all"
              placeholder="Enter your password"
              required
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
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#6ba3d3] text-white font-bold rounded-xl hover:bg-[#5a92c2] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed uppercase text-sm tracking-wide"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignInModal;
