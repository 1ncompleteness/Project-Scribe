import axios, { AxiosResponse } from 'axios';

// Use the same URL pattern as other services
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `http://${window.location.hostname}:8585` 
  : process.env.REACT_APP_API_URL || 'http://backend:8585';

console.log('AGNISService using API URL:', API_URL);

// Set up axios instance with auth header
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Types
export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  tags: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export interface QuestionResponse {
  answer: string;
  sources: string[];
  model: string;
}

export interface SummaryResponse {
  summary: string;
  note_id: string;
  title: string;
}

export interface TemplateResponse {
  template: string;
  title_suggestion: string;
}

// Service methods
const AGNISService = {
  // Full-text search
  searchFullText: (query: string): Promise<AxiosResponse<SearchResponse>> => {
    return apiClient.get(`/api/search?query=${encodeURIComponent(query)}`);
  },
  
  // Semantic search
  searchSemantic: (query: string): Promise<AxiosResponse<SearchResponse>> => {
    return apiClient.get(`/api/search/semantic?query=${encodeURIComponent(query)}`);
  },
  
  // Tag search
  searchByTags: (query: string): Promise<AxiosResponse<SearchResponse>> => {
    return apiClient.get(`/api/search/tags?query=${encodeURIComponent(query)}`);
  },
  
  // Question answering with streaming response
  askQuestion: (question: string, systemPrompt: string): Promise<ReadableStream<Uint8Array>> => {
    const params = new URLSearchParams({
      text: question,
      system_prompt: systemPrompt,
      rag: 'true'
    }).toString();
    
    // Use fetch for streaming instead of axios
    return fetch(`${API_URL}/api/query-stream?${params}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.body as ReadableStream<Uint8Array>;
    });
  },
  
  // Note summarization
  summarizeNote: (noteId: string, maxLength: number = 150): Promise<AxiosResponse<SummaryResponse>> => {
    return apiClient.post('/api/notes/summarize', {
      note_id: noteId,
      max_length: maxLength
    });
  },
  
  // Note template generation
  generateTemplate: (noteType: string, details: string = ''): Promise<AxiosResponse<TemplateResponse>> => {
    return apiClient.post('/api/notes/template', {
      note_type: noteType,
      details: details
    });
  }
};

export default AGNISService; 