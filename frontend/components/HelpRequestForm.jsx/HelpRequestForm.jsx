import React, { useState } from 'react';
import axios from 'axios';

const HelpRequestForm = () => {
    const [formData, setFormData] = useState({
        submitterName: '',
        category: '',
        urgency: '',
        location: '',
        description: ''
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

        // Basic validation
        if (!formData.category || !formData.urgency || !formData.location || !formData.description) {
            setError('Please fill in all required fields');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('http://localhost:3000/api/requests', formData);

            if (response.data.success) {
                setSuccess(true);
                // Reset form
                setFormData({
                    submitterName: '',
                    category: '',
                    urgency: '',
                    location: '',
                    description: ''
                });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Request Help</h1>
                <p className="text-gray-600 mb-6">Fill out this form to request assistance during a crisis</p>

                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-green-800 font-medium">✓ Request submitted successfully!</p>
                        <p className="text-green-700 text-sm mt-1">We'll prioritize your request and connect you with help soon.</p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name (optional) */}
                    <div>
                        <label htmlFor="submitterName" className="block text-sm font-medium text-gray-700 mb-2">
                            Your Name (Optional)
                        </label>
                        <input
                            type="text"
                            id="submitterName"
                            name="submitterName"
                            value={formData.submitterName}
                            onChange={handleChange}
                            placeholder="Enter your name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">You can submit anonymously</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select a category</option>
                            <option value="Food">Food</option>
                            <option value="Shelter">Shelter</option>
                            <option value="Medical">Medical</option>
                            <option value="Transport">Transportation</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Urgency */}
                    <div>
                        <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-2">
                            Urgency Level <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="urgency"
                            name="urgency"
                            value={formData.urgency}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select urgency level</option>
                            <option value="Low">Low - Can wait a few days</option>
                            <option value="Medium">Medium - Needed within 24 hours</option>
                            <option value="High">High - Needed within a few hours</option>
                            <option value="Critical">Critical - Immediate assistance needed</option>
                        </select>
                    </div>

                    {/* Location */}
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                            Location <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="City, zip code, or address"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Describe what help you need..."
                            required
                            rows="4"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default HelpRequestForm;