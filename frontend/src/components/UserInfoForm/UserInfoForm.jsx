import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function UserInfoForm({ role, onClose }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    location: ''
  });

  const getRoleTitle = () => {
    switch (role) {
      case 'help-seeker':
        return 'Get Help';
      case 'volunteer':
        return 'Volunteer';
      case 'organization':
        return 'Organization Registration';
      default:
        return 'Registration';
    }
  };

  const getRoleDescription = () => {
    switch (role) {
      case 'help-seeker':
        return 'Tell us who you are and where you need help.';
      case 'volunteer':
        return 'Tell us who you are so we can connect you with those in need.';
      case 'organization':
        return 'Tell us about your organization.';
      default:
        return '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Store user info in localStorage (no backend auth for MVP)
    localStorage.setItem('userRole', role);
    localStorage.setItem('userName', formData.name);
    localStorage.setItem('userLocation', formData.location);

    // Navigate to appropriate view
    switch (role) {
      case 'help-seeker':
        navigate('/help-seeker');
        break;
      case 'volunteer':
        navigate('/volunteer');
        break;
      case 'organization':
        navigate('/organization');
        break;
      default:
        navigate('/');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Form Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{getRoleTitle()}</h2>
          <p className="text-gray-600">{getRoleDescription()}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Your Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location (optional)
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="City, State or ZIP code"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition transform hover:scale-105 shadow-lg"
          >
            Continue
          </button>
        </form>

        {/* Helper text */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          No password needed. We keep it simple during emergencies.
        </p>
      </div>
    </div>
  );
}

export default UserInfoForm;
