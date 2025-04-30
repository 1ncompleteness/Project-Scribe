import axios from 'axios';

// Use an URL that works in browser context
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `http://${window.location.hostname}:8585` 
  : process.env.REACT_APP_API_URL || 'http://backend:8585';

console.log('Using API URL:', API_URL);

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    console.log('Making request to:', API_URL + config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

interface LoginData {
  username: string;
  password: string;
}

const register = (data: RegisterData) => {
  console.log('Registering user with backend at:', API_URL + '/register');
  return apiClient.post('/register', data);
};

const login = async (data: LoginData) => {
    console.log('Logging in user with backend at:', API_URL + '/token');
    // FastAPI's OAuth2PasswordRequestForm expects form data
    const formData = new URLSearchParams();
    formData.append('username', data.username);
    formData.append('password', data.password);

    const response = await apiClient.post('/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  return response.data;
};

const logout = () => {
  localStorage.removeItem('token');
};

const getCurrentUser = () => {
  return apiClient.get('/users/me');
};

const AuthService = {
  register,
  login,
  logout,
  getCurrentUser,
};

export default AuthService; 