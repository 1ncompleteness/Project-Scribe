import axios from 'axios';

// Use the same URL pattern as AuthService
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `http://${window.location.hostname}:8585` 
  : process.env.REACT_APP_API_URL || 'http://backend:8585';

console.log('NoteService using API URL:', API_URL);

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
export interface NoteContent {
  text: string;
  images?: string[]; // Base64 encoded images
  audio?: string; // Base64 encoded audio
}

export interface Note {
  id: string;
  title: string;
  content: NoteContent;
  created_at: string;
  updated_at: string;
  tags: string[];
  journal_id?: string;
}

export interface NoteCreateRequest {
  title: string;
  content: NoteContent;
  journal_id?: string;
  tags: string[];
}

export interface NoteUpdateRequest {
  title?: string;
  content?: NoteContent;
  tags?: string[];
  journal_id?: string;
}

export interface Journal {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  template?: Record<string, string>;
}

export interface JournalCreateRequest {
  title: string;
  description?: string;
  template?: Record<string, string>;
}

export interface JournalUpdateRequest {
  title?: string;
  description?: string;
  template?: Record<string, string>;
}

// Note API methods
const getNotes = () => {
  return apiClient.get<Note[]>('/api/notes').then(response => {
    // Ensure all notes have the required properties
    const processedNotes = response.data.map(note => ({
      ...note,
      content: {
        text: note.content.text || '',
        images: note.content.images || [],
        audio: note.content.audio
      },
      tags: note.tags || []
    }));
    return {
      ...response,
      data: processedNotes
    };
  });
};

const getNote = (id: string) => {
  return apiClient.get<Note>(`/api/notes/${id}`).then(response => {
    const processedNote = {
      ...response.data,
      content: {
        text: response.data.content.text || '',
        images: response.data.content.images || [],
        audio: response.data.content.audio
      },
      tags: response.data.tags || []
    };
    return {
      ...response,
      data: processedNote
    };
  });
};

const createNote = (noteData: NoteCreateRequest) => {
  return apiClient.post<Note>('/api/notes', noteData).then(response => {
    // Trigger embedding generation in the background
    apiClient.post(`/api/notes/embeddings/${response.data.id}`)
      .catch(err => console.error('Failed to generate embeddings:', err));
    return response;
  });
};

const updateNote = (id: string, noteData: NoteUpdateRequest) => {
  return apiClient.put<Note>(`/api/notes/${id}`, noteData).then(response => {
    // Trigger embedding generation in the background only if content was updated
    if (noteData.content) {
      apiClient.post(`/api/notes/embeddings/${id}`)
        .catch(err => console.error('Failed to generate embeddings:', err));
    }
    return response;
  });
};

const deleteNote = (id: string) => {
  return apiClient.delete(`/api/notes/${id}`);
};

// Journal API methods
const getJournals = () => {
  return apiClient.get<Journal[]>('/api/journals');
};

const getJournal = (id: string) => {
  return apiClient.get<Journal>(`/api/journals/${id}`);
};

const getJournalNotes = (id: string) => {
  return apiClient.get<Note[]>(`/api/journals/${id}/notes`).then(response => {
    // Ensure all notes have the required properties
    const processedNotes = response.data.map(note => ({
      ...note,
      content: {
        text: note.content.text || '',
        images: note.content.images || [],
        audio: note.content.audio
      },
      tags: note.tags || []
    }));
    return {
      ...response,
      data: processedNotes
    };
  });
};

const createJournal = (journalData: JournalCreateRequest) => {
  return apiClient.post<Journal>('/api/journals', journalData).then(response => {
    // Trigger embedding generation in the background
    apiClient.post(`/api/journals/embeddings/${response.data.id}`)
      .catch(err => console.error('Failed to generate embeddings for journal:', err));
    return response;
  });
};

const updateJournal = (id: string, journalData: JournalUpdateRequest) => {
  return apiClient.put<Journal>(`/api/journals/${id}`, journalData).then(response => {
    // Generate embeddings for journal after update
    apiClient.post(`/api/journals/embeddings/${id}`)
      .catch(err => console.error('Failed to generate embeddings for journal:', err));
    return response;
  });
};

const deleteJournal = (id: string, deleteNotes: boolean = false) => {
  return apiClient.delete(`/api/journals/${id}?delete_notes=${deleteNotes}`);
};

const NoteService = {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getJournals,
  getJournal,
  getJournalNotes,
  createJournal,
  updateJournal,
  deleteJournal
};

export default NoteService; 