import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState('loading...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/health`);
        setStatus(response.data.message);
      } catch (err) {
        setError('Failed to connect to backend');
        console.error(err);
      }
    };

    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-indigo-600 mb-2">
            Crisis360
          </h1>
          <p className="text-gray-600 mb-6">
            AI-Powered Crisis Coordination
          </p>
          
          <div className="space-y-4">
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  ❌ {error}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Make sure backend is running on port 3000
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✅ <span className="font-semibold">Backend:</span> {status}
                </p>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Frontend:</span> Running on Vite
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
              Team MAJic - Week 1 Sprint
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
