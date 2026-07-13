import HelpRequestForm from '../components/HelpRequestForm.jsx/HelpRequestForm';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-indigo-600 mb-2">
            Crisis360
          </h1>
          <p className="text-gray-600">
            AI-Powered Crisis Coordination Platform
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Team MAJic - Week 1 MVP
          </p>
        </div>

        <HelpRequestForm />
      </div>
    </div>
  );
}

export default App;
