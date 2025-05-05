import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/AuthService';
import NoteService, { Note, Journal, NoteContent } from '../services/NoteService';
import NoteEditor from '../components/NoteEditor';
import AGNISSidebar from '../components/AGNISSidebar';

interface UserData {
  username: string;
  email: string;
  full_name?: string;
}

// Define settings interface
interface SettingsState {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
}

function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'journals'>('notes');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isCreatingJournal, setIsCreatingJournal] = useState(false);
  const [journalTitle, setJournalTitle] = useState('');
  const [journalDescription, setJournalDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAGNIS, setShowAGNIS] = useState(true);
  const [initialNoteTitle, setInitialNoteTitle] = useState('');
  const [initialNoteContent, setInitialNoteContent] = useState<NoteContent | null>(null);
  const [settings, setSettings] = useState<SettingsState>(() => {
    // Get settings from localStorage
    const savedSettings = localStorage.getItem('projectScribeSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Error parsing saved settings:', e);
      }
    }
    
    // Default settings
    return {
      darkMode: false,
      fontSize: 'medium',
      highContrast: false,
      reducedMotion: false
    };
  });
  const navigate = useNavigate();

  // Get the appropriate logo based on dark mode setting
  const getLogoSrc = () => {
    return settings.darkMode ? "/feather-dark.svg" : "/feather-light.svg";
  };

  // Handle settings changes from AGNISSidebar
  const handleSettingsChange = (newSettings: SettingsState) => {
    setSettings(newSettings);
  };

  // Find journal by ID for a note
  const findJournalById = (journalId: string | undefined) => {
    if (!journalId) return null;
    return journals.find(journal => journal.id === journalId) || null;
  };

  // Fetch user data, notes, and journals on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Check if token exists before fetching data
        if (!localStorage.getItem('token')) {
          console.log('No token found, redirecting to login');
          navigate('/login'); // Redirect if no token
          return;
        }

        console.log('Token found, fetching user data');
        // Fetch user data
        const userResponse = await AuthService.getCurrentUser();
        console.log('User data received:', userResponse.data);
        setUserData(userResponse.data);

        // Fetch notes
        const notesResponse = await NoteService.getNotes();
        console.log(`Retrieved ${notesResponse.data.length} notes`);
        setNotes(notesResponse.data);

        // Fetch journals
        const journalsResponse = await NoteService.getJournals();
        console.log(`Retrieved ${journalsResponse.data.length} journals`);
        setJournals(journalsResponse.data);

        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        console.error('Error response:', err.response);
        setError('Failed to load user data. Please try logging in again.');
        setIsLoading(false);
        AuthService.logout(); // Log out if token is invalid or expired
        // Navigate immediately instead of setTimeout
        navigate('/login');
      }
    };

    fetchData();
  }, [navigate]);

   const handleLogout = () => {
     AuthService.logout();
     navigate('/login');
   };

  const fetchJournalNotes = async (journalId: string) => {
    try {
      setIsLoading(true);
      const response = await NoteService.getJournalNotes(journalId);
      setNotes(response.data);
      setIsLoading(false);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch journal notes:', err);
      setIsLoading(false);
      return [];
    }
  };

  // Note CRUD operations
  const createNote = async (title: string, content: NoteContent, tags: string[]) => {
    try {
      setIsLoading(true);
      const noteData = {
        title: title,
        content: content,
        journal_id: selectedJournal?.id,
        tags: tags
      };

      const response = await NoteService.createNote(noteData);
      
      // Update notes list
      if (selectedJournal) {
        await fetchJournalNotes(selectedJournal.id);
      } else {
        setNotes(prevNotes => [response.data, ...prevNotes]);
      }
      
      setIsCreatingNote(false);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to create note. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSaveNote = async (title: string, content: NoteContent, tags: string[]) => {
    try {
      setIsLoading(true);
      
      if (selectedNote) {
        // Updating existing note
        const updateData = {
          title,
          content,
          tags
        };
        
        const response = await NoteService.updateNote(selectedNote.id, updateData);
        
        // Update notes list
        setNotes(prevNotes =>
          prevNotes.map(n => (n.id === selectedNote.id ? response.data : n))
        );
        
        setSelectedNote(response.data);
        setIsEditingNote(false);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update note:', err);
      setError('Failed to update note. Please try again.');
      setIsLoading(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    try {
      setIsLoading(true);
      await NoteService.deleteNote(noteId);
      
      // Update notes list
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError('Failed to delete note. Please try again.');
      setIsLoading(false);
    }
  };

  // Journal CRUD operations
  const createJournal = async () => {
    try {
      setIsLoading(true);
      const journalData = {
        title: journalTitle,
        description: journalDescription
      };

      const response = await NoteService.createJournal(journalData);
      
      // Update journals list
      setJournals(prevJournals => [response.data, ...prevJournals]);
      
      // Reset form
      setJournalTitle('');
      setJournalDescription('');
      setIsCreatingJournal(false);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to create journal:', err);
      setError('Failed to create journal. Please try again.');
      setIsLoading(false);
    }
  };

  const deleteJournal = async (journalId: string) => {
    if (!window.confirm('Are you sure you want to delete this journal?')) return;
    
    const deleteNotes = window.confirm('Do you want to delete all notes in this journal as well?');
    
    try {
      setIsLoading(true);
      await NoteService.deleteJournal(journalId, deleteNotes);
      
      // Update journals list
      setJournals(prevJournals => prevJournals.filter(journal => journal.id !== journalId));
      
      if (selectedJournal?.id === journalId) {
        setSelectedJournal(null);
        // Refresh notes if we're not deleting them
        if (!deleteNotes) {
          const notesResponse = await NoteService.getNotes();
          setNotes(notesResponse.data);
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to delete journal:', err);
      setError('Failed to delete journal. Please try again.');
      setIsLoading(false);
    }
  };

  const selectJournal = async (journal: Journal) => {
    setSelectedJournal(journal);
    setSelectedNote(null);
    await fetchJournalNotes(journal.id);
  };

  const clearJournalSelection = async () => {
    setSelectedJournal(null);
    // Fetch all notes
    const notesResponse = await NoteService.getNotes();
    setNotes(notesResponse.data);
  };

  // Debug function to check note structure
  useEffect(() => {
    if (selectedNote) {
      console.log('Selected note:', selectedNote);
      console.log('Note content:', selectedNote.content);
      console.log('Note images:', selectedNote.content.images);
      console.log('Note audio:', selectedNote.content.audio);
      console.log('Note tags:', selectedNote.tags);
    }
  }, [selectedNote]);

  // Select a note based on the ID (for AGNIS search results)
  const handleNoteSelected = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNote(note);
    }
  };

  // Add a new function to handle template-based note creation
  const handleCreateFromTemplate = (title: string, templateContent: string) => {
    // Store the template content in state variables
    setInitialNoteTitle(title);
    setInitialNoteContent({
      text: templateContent,
      images: []
    });
    
    // Set creating note flag
    setIsCreatingNote(true);
  };

  if (error) {
     return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-red-500">{error}</p></div>;
  }

  if (!userData || isLoading) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p>Loading dashboard...</p></div>;
  }

  // Render dashboard UI
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white shadow dark:bg-gray-800">
        <div className="mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <img src={getLogoSrc()} alt="Project Scribe" className="h-8 mr-3" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Project Scribe</h1>
          </div>
          <div className="flex items-center space-x-4">
            {userData && (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {userData.full_name || userData.username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'notes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'journals' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('journals')}
          >
            Journals
          </button>
          
          {/* AGNIS toggle button */}
          {activeTab === 'notes' && (
            <button
              className={`ml-auto px-4 py-2 font-medium ${
                showAGNIS ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setShowAGNIS(!showAGNIS)}
            >
              {showAGNIS ? 'Hide AGNIS' : 'Show AGNIS'}
            </button>
          )}
        </div>

        {activeTab === 'notes' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar - Journals and Notes list */}
            <div className={`col-span-12 ${showAGNIS ? 'md:col-span-3 lg:col-span-2' : 'md:col-span-4 lg:col-span-3'} bg-white rounded-lg shadow-md overflow-hidden`}>
              <div className="p-4 border-b border-gray-200">
                {selectedJournal ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-semibold">{selectedJournal.title}</h2>
                      <button
                        onClick={clearJournalSelection}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Back to All Notes
                      </button>
                    </div>
                    {selectedJournal.description && (
                      <p className="text-gray-600 text-sm mb-2">{selectedJournal.description}</p>
                    )}
                    <p className="text-gray-500 text-sm">{selectedJournal.note_count} notes</p>
                  </div>
                ) : (
                  <h2 className="text-xl font-semibold">All Notes</h2>
                )}
                <button
                  onClick={() => setIsCreatingNote(true)}
                  className="mt-2 w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  New Note
                </button>
              </div>

              <div className="overflow-y-auto max-h-96">
                {notes.length === 0 ? (
                  <p className="p-4 text-gray-500">No notes yet. Create your first note!</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedNote?.id === note.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedNote(note)}
                      >
                        <h3 className="font-medium text-gray-900 truncate">{note.title}</h3>
                        <p className="text-gray-500 text-sm truncate">
                          {note.content.text.substring(0, 60)}
                          {note.content.text.length > 60 ? '...' : ''}
                        </p>
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-gray-400">
                            {new Date(note.updated_at).toLocaleDateString()}
                          </p>
                          <div className="flex flex-wrap">
                            {/* Show journal indicator when viewing all notes (not in a specific journal) */}
                            {!selectedJournal && note.journal_id && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1">
                                {(() => {
                                  const journal = findJournalById(note.journal_id);
                                  return journal ? 
                                    journal.title.substring(0, 10) + (journal.title.length > 10 ? '...' : '') : 
                                    'Journal';
                                })()}
                              </span>
                            )}
                            {note.tags.length > 0 && (
                              <div className="flex flex-wrap">
                                {note.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded mr-1"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {note.tags.length > 2 && (
                                  <span className="text-xs text-gray-500">+{note.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Main content area */}
            <div className={`col-span-12 ${showAGNIS ? 'md:col-span-6 lg:col-span-7' : 'md:col-span-8 lg:col-span-9'}`}>
              {isEditingNote && selectedNote ? (
                <NoteEditor
                  note={selectedNote}
                  journalId={selectedJournal?.id}
                  onSave={handleSaveNote}
                  onCancel={() => setIsEditingNote(false)}
                />
              ) : isCreatingNote ? (
                <div className="col-span-12 md:col-span-9 lg:col-span-9">
                  <NoteEditor
                    journalId={selectedJournal?.id}
                    // Pass initial values if they exist
                    initialTitle={initialNoteTitle}
                    initialContent={initialNoteContent}
                    onSave={(title, content, tags) => {
                      createNote(title, content, tags);
                      // Reset initial values after save
                      setInitialNoteTitle('');
                      setInitialNoteContent(null);
                    }}
                    onCancel={() => {
                      setIsCreatingNote(false);
                      // Reset initial values on cancel
                      setInitialNoteTitle('');
                      setInitialNoteContent(null);
                    }}
                  />
                </div>
              ) : selectedNote ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-semibold">{selectedNote.title}</h2>
                      
                      {/* Show journal information if note belongs to a journal */}
                      {selectedNote.journal_id && (
                        <div className="mt-1">
                          {(() => {
                            const journal = findJournalById(selectedNote.journal_id);
                            return journal ? (
                              <div className="flex items-center">
                                <span className="text-sm text-blue-600 mr-1">In journal:</span>
                                <span 
                                  className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-200"
                                  onClick={() => {
                                    if (journal) {
                                      selectJournal(journal);
                                    }
                                  }}
                                  title="Click to view this journal"
                                >
                                  {journal.title}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">In unknown journal</span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setIsEditingNote(true)}
                        className="text-blue-500 hover:text-blue-700 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNote(selectedNote.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Text content */}
                  <div className="mb-4 whitespace-pre-wrap">{selectedNote.content.text}</div>
                  
                  {/* Display tags */}
                  {selectedNote.tags && selectedNote.tags.length > 0 && (
                    <div className="flex flex-wrap mb-4">
                      <h3 className="font-medium text-gray-700 w-full mb-2">Tags</h3>
                      {selectedNote.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-sm bg-gray-200 text-gray-700 px-2 py-1 rounded mr-2 mb-2"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Display images */}
                  {selectedNote.content && selectedNote.content.images && selectedNote.content.images.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-2">Images</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedNote.content.images.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={image}
                              alt={`Item ${index + 1}`}
                              className="w-full max-h-96 object-contain rounded cursor-pointer"
                              onClick={() => window.open(image, '_blank')}
                              title="Click to view full size"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Display audio */}
                  {selectedNote.content && selectedNote.content.audio && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-2">Audio</h3>
                      <audio controls src={selectedNote.content.audio} className="w-full"></audio>
                    </div>
                  )}
                  
                  <div className="text-gray-500 text-sm">
                    Updated {new Date(selectedNote.updated_at).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <p className="text-gray-500">Select a note from the list to view its content, or create a new note.</p>
                </div>
              )}
            </div>
            
            {/* AGNIS Sidebar */}
            {showAGNIS && activeTab === 'notes' && (
              <div className="col-span-12 md:col-span-3 lg:col-span-3">
                <AGNISSidebar 
                  notes={notes} 
                  onNoteSelected={handleNoteSelected}
                  onCreateNote={handleCreateFromTemplate}
                  onSettingsChange={handleSettingsChange}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'journals' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Your Journals</h2>
              <button
                onClick={() => setIsCreatingJournal(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                New Journal
              </button>
            </div>

            {isCreatingJournal && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">Create New Journal</h3>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="journalTitle">
                    Title
                  </label>
                  <input
                    id="journalTitle"
                    type="text"
                    value={journalTitle}
                    onChange={(e) => setJournalTitle(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Journal title"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="journalDescription">
                    Description
                  </label>
                  <textarea
                    id="journalDescription"
                    value={journalDescription}
                    onChange={(e) => setJournalDescription(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
                    placeholder="Journal description (optional)"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsCreatingJournal(false)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createJournal}
                    disabled={!journalTitle}
                    className={`${
                      !journalTitle
                        ? 'bg-blue-300 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-700'
                    } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
                  >
                    Create Journal
                  </button>
                </div>
              </div>
            )}

            {journals.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-500">No journals yet. Create your first journal!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {journals.map((journal) => (
                  <div key={journal.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">{journal.title}</h3>
                      {journal.description && (
                        <p className="text-gray-600 mb-4">{journal.description}</p>
                      )}
                      <p className="text-gray-500 text-sm mb-4">
                        {journal.note_count} notes • Created{' '}
                        {new Date(journal.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setActiveTab('notes');
                            selectJournal(journal);
                          }}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                          View Notes
                        </button>
                        <button
                          onClick={() => deleteJournal(journal.id)}
                          className="text-red-500 hover:text-red-700 border border-red-500 hover:border-red-700 font-bold py-2 px-4 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
        )}
      </main>
    </div>
  );
}

export default DashboardPage; 