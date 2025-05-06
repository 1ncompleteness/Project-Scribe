import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthService from '../services/AuthService';

// Add build version info
const BUILD_VERSION = "0.9.9 Alpha";
const BUILD_DATE = "2025-05-05";

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  // Check dark mode preference
  useEffect(() => {
    // Check for dark mode setting
    const savedSettings = localStorage.getItem('projectScribeSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setDarkMode(settings.darkMode || false);
        
        // Apply dark mode to body if enabled
        if (settings.darkMode) {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      } catch (e) {
        console.error('Error parsing saved settings:', e);
      }
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      console.log('Sending registration data:', { username, email, password, full_name: fullName || undefined });
      const response = await AuthService.register({ username, email, password, full_name: fullName || undefined });
      console.log('Registration successful:', response);
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000); // Redirect after 2 seconds
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
        // Check if the error contains "Username or email already registered" regardless of status code
        const errorDetail = err.response.data?.detail || '';
        if (errorDetail.includes('Username or email already registered')) {
          setError('Username or email is already registered. Please use different credentials.');
        } else {
          setError(`Registration failed: ${errorDetail || JSON.stringify(err.response.data) || 'Unknown error'}`);
        }
      } else if (err.request) {
        console.error('No response received:', err.request);
        setError('Registration failed: No response from server. Check network connectivity.');
      } else {
        console.error('Error message:', err.message);
        setError(`Registration failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="flex-grow flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
          <img src="/project-scribe-icon.svg" className="h-32 mx-auto mb-6" alt="Project Scribe logo" />
          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Register for Project Scribe</h1>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          {success && <p className="text-green-500 text-center mb-4">{success}</p>}
          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="username">
                Username
              </label>
              <input
                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="username" type="text" placeholder="Username"
                value={username} onChange={(e) => setUsername(e.target.value)} required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="email" type="email" placeholder="Email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
             <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="fullName">
                Full Name (Optional)
              </label>
              <input
                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="fullName" type="text" placeholder="Full Name"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                id="password" type="password" placeholder="******************"
                value={password} onChange={(e) => setPassword(e.target.value)} required
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                type="submit"
              >
                Register
              </button>
            </div>
          </form>
           <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-6">
            Already have an account? <Link to="/login" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Login here</Link>
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Project Scribe. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Version {BUILD_VERSION} (Build: {BUILD_DATE})
          </p>
        </div>
      </footer>
    </div>
  );
}

export default RegisterPage; 