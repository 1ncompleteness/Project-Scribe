import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState<string>('');
  const apiUrl = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Uses the API URL from environment variables
        const response = await axios.get(`${apiUrl}/api/hello`);
        setMessage(response.data.message);
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage('Error connecting to backend');
      }
    };

    fetchData();
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Project Scribe</h1>
        <p className="text-gray-600">{message || 'Loading...'}</p>
      </div>
    </div>
  );
}

export default App; 