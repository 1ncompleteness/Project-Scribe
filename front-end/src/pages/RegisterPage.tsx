import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthService from '../services/AuthService';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

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
        setError(`Registration failed: ${err.response.data?.detail || JSON.stringify(err.response.data) || 'Unknown error'}`);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <img src="/react-logo.svg" className="h-20 mx-auto mb-6" alt="React logo" />
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Register for Project Scribe</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && <p className="text-green-500 text-center mb-4">{success}</p>}
        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="username" type="text" placeholder="Username"
              value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="email" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </div>
           <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fullName">
              Full Name (Optional)
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="fullName" type="text" placeholder="Full Name"
              value={fullName} onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
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
         <p className="text-center text-gray-500 text-xs mt-6">
          Already have an account? <Link to="/login" className="text-blue-500 hover:text-blue-700">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage; 