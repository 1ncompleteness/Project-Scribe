import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthService from '../services/AuthService';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in and check dark mode preference
  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
    
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
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await AuthService.login({ username, password });
      console.log('Login successful, token received:', !!response.access_token);
      
      // Use React Router navigation instead of window.location
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <img src="/project-scribe-icon.svg" className="h-20 mx-auto mb-6" alt="Project Scribe logo" />
        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Login to Project Scribe</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              placeholder="******************"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
              type="submit"
            >
              Sign In
            </button>
          </div>
        </form>
        <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-6">
          Don't have an account? <Link to="/register" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage; 