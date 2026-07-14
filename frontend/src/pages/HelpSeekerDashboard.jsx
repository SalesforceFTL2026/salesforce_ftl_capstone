import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header/Header';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
import RequestCard from '../components/RequestCard/RequestCard';
import api from '../utils/api';

// Help-Seeker Dashboard: your submitted requests (main area) + a compact
// "Request Help" form (side column). Matches the project's sage/green theme.
const HelpSeekerDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load the logged-in user's requests. Wrapped in useCallback so the form's
  // onCreated can re-run it after a new submission.
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/requests/my-requests');
      setRequests(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <div className="min-h-screen bg-[#f4f6f1] dark:bg-[#0f1a0f] transition-colors duration-300">
      <Header />
      <div className="pt-[90px] pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-8">
            My Dashboard
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main column: My Requests */}
            <section className="lg:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
                My Requests
              </h2>

              {loading && (
                <p className="text-gray-500 dark:text-gray-400">Loading your requests…</p>
              )}

              {error && !loading && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                  <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {!loading && !error && requests.length === 0 && (
                <div className="bg-white dark:bg-[#273A20] rounded-2xl p-8 text-center transition-colors duration-300">
                  <p className="text-gray-600 dark:text-gray-300">
                    You haven't submitted any requests yet.
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                    Use the form on the right to request help.
                  </p>
                </div>
              )}

              {!loading && !error && requests.length > 0 && (
                <div className="space-y-4">
                  {requests.map((r) => (
                    <RequestCard key={r.id} request={r} />
                  ))}
                </div>
              )}
            </section>

            {/* Side column: compact request form */}
            <aside className="lg:col-span-1">
              <HelpRequestForm compact onCreated={loadRequests} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSeekerDashboard;
