import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/AuthService';

interface UserData {
  username: string;
  email: string;
  full_name?: string;
}

function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await AuthService.getCurrentUser();
        setUserData(response.data);
      } catch (err: any) {
        console.error('Failed to fetch user data:', err);
        setError('Failed to load user data. Please try logging in again.');
        AuthService.logout(); // Log out if token is invalid or expired
         // Delay navigation slightly to allow state update
         setTimeout(() => navigate('/login'), 50);
      }
    };

    // Check if token exists before fetching data
    if (localStorage.getItem('token')) {
         fetchUserData();
    } else {
        navigate('/login'); // Redirect if no token
    }
  }, [navigate]); // Add navigate to dependency array

   const handleLogout = () => {
     AuthService.logout();
     navigate('/login');
   };

  if (error) {
     // Error state is handled by redirecting in useEffect
     return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-red-500">{error}</p></div>;
  }

  if (!userData) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p>Loading dashboard...</p></div>; // Loading state
  }


  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-3xl font-bold text-gray-800">Welcome, {userData.full_name || userData.username}!</h1>
           <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Logout
          </button>
        </div>

        <div className="mb-4">
          <p><strong>Username:</strong> {userData.username}</p>
          <p><strong>Email:</strong> {userData.email}</p>
        </div>

        {/* Add more dashboard content here */}
         <p className="text-gray-600">This is your Project Scribe dashboard.</p>

      </div>
    </div>
  );
}

export default DashboardPage; 