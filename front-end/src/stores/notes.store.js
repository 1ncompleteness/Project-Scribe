import { writable, get } from 'svelte/store';
import notesService from '../services/notes.service';
import { authStore } from './auth.store';

// Note operation states
export const noteStates = {
    IDLE: 'idle',
    LOADING: 'loading',
    SAVING: 'saving',
    ERROR: 'error'
};

// Create the notes store
function createNotesStore() {
    const { subscribe, set, update } = writable({
        state: noteStates.IDLE,
        notes: [],
        currentNote: null,
        error: null,
        journals: [],
        tags: [],
        filteredNotes: [],
        searchTerm: ''
    });

    return {
        subscribe,
        
        // Initialize data from Neo4j
        init: async () => {
            update(store => ({ ...store, state: noteStates.LOADING }));
            
            try {
                const authState = get(authStore);
                
                // Check if user is logged in
                if (!authState.user) {
                    update(store => ({
                        ...store,
                        state: noteStates.IDLE,
                        notes: [],
                        journals: [],
                        tags: [],
                        filteredNotes: []
                    }));
                    return;
                }
                
                const userId = authState.user.id;
                
                // Load notes
                const notes = await notesService.getNotes(userId);
                
                // Load journals
                const journals = await notesService.getJournals(userId);
                
                // Load tags
                const tags = await notesService.getUserTags(userId);
                
                update(store => ({
                    ...store,
                    state: noteStates.IDLE,
                    notes,
                    journals,
                    tags,
                    filteredNotes: notes
                }));
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
            }
        },
        
        // Create a new note
        createNote: async (title = 'Untitled Note', content = '', tags = []) => {
            // Set state to SAVING before starting the operation
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                const authState = get(authStore);
                if (!authState.user) {
                    throw new Error('User not authenticated');
                }
                
                const userId = authState.user.id;
                
                const newNote = await notesService.createNote(userId, title, content, tags);
                
                // Update the store with the new note and set state to IDLE
                update(store => {
                    const updatedNotes = [...store.notes, newNote];
                    
                    return {
                        ...store,
                        state: noteStates.IDLE, // Ensure this is set to IDLE
                        notes: updatedNotes,
                        filteredNotes: store.searchTerm 
                            ? updatedNotes.filter(note => 
                                note.title.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.content.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.tags.some(tag => tag.toLowerCase().includes(store.searchTerm.toLowerCase()))
                            )
                            : updatedNotes,
                        currentNote: newNote
                    };
                });
                
                // Make sure state is IDLE even if something went wrong with the update process
                setTimeout(() => {
                    update(store => {
                        if (store.state === noteStates.SAVING) {
                            return { ...store, state: noteStates.IDLE };
                        }
                        return store;
                    });
                }, 1000); // Add a 1-second failsafe
                
                return true;
            } catch (error) {
                // Set state to ERROR if there was an error
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                
                // Set state back to IDLE after a short delay
                setTimeout(() => {
                    update(store => ({ ...store, state: noteStates.IDLE }));
                }, 2000);
                
                return false;
            }
        },
        
        // Update an existing note
        updateNote: async (noteId, updatedData) => {
            // Set state to SAVING before starting the update
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                const { title, content, tags } = updatedData;
                
                // Find the current note to get existing data for any missing fields
                let currentNote;
                
                // Use a temporary variable to access the store state
                let storeSnapshot = { notes: [] };
                update(state => {
                    storeSnapshot = state;
                    return state;
                });
                
                const noteIndex = storeSnapshot.notes.findIndex(note => note.id === noteId);
                
                if (noteIndex === -1) {
                    throw new Error('Note not found');
                }
                
                currentNote = storeSnapshot.notes[noteIndex];
                
                // Update the note in Neo4j
                const updatedNote = await notesService.updateNote(
                    noteId,
                    title || currentNote.title,
                    content || currentNote.content,
                    tags || currentNote.tags
                );
                
                // Update the store with the updated note and set state to IDLE
                update(store => {
                    const updatedNotes = [...store.notes];
                    const idx = updatedNotes.findIndex(note => note.id === noteId);
                    
                    if (idx !== -1) {
                        updatedNotes[idx] = updatedNote;
                    }
                    
                    return {
                        ...store,
                        state: noteStates.IDLE, // Ensure this is set to IDLE
                        notes: updatedNotes,
                        filteredNotes: store.searchTerm 
                            ? updatedNotes.filter(note => 
                                note.title.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.content.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.tags.some(tag => tag.toLowerCase().includes(store.searchTerm.toLowerCase()))
                            )
                            : updatedNotes,
                        currentNote: updatedNote
                    };
                });
                
                // Make sure state is IDLE even if something went wrong with the update process
                setTimeout(() => {
                    update(store => {
                        if (store.state === noteStates.SAVING) {
                            return { ...store, state: noteStates.IDLE };
                        }
                        return store;
                    });
                }, 1000); // Add a 1-second failsafe
                
                return true;
            } catch (error) {
                // Set state to ERROR if there was an error
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                
                // Set state back to IDLE after a short delay
                setTimeout(() => {
                    update(store => ({ ...store, state: noteStates.IDLE }));
                }, 2000);
                
                return false;
            }
        },
        
        // Delete a note
        deleteNote: async (noteId) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                // Delete the note from Neo4j
                await notesService.deleteNote(noteId);
                
                update(store => {
                    const updatedNotes = store.notes.filter(note => note.id !== noteId);
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        notes: updatedNotes,
                        filteredNotes: store.searchTerm 
                            ? updatedNotes.filter(note => 
                                note.title.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.content.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.tags.some(tag => tag.toLowerCase().includes(store.searchTerm.toLowerCase()))
                            )
                            : updatedNotes,
                        currentNote: null
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Set the current note being viewed/edited
        setCurrentNote: (noteId) => {
            update(store => {
                const currentNote = store.notes.find(note => note.id === noteId) || null;
                return { ...store, currentNote };
            });
        },
        
        // Create a new journal
        createJournal: async (title, description = '') => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                const authState = get(authStore);
                if (!authState.user) {
                    throw new Error('User not authenticated');
                }
                
                const userId = authState.user.id;
                
                const newJournal = await notesService.createJournal(userId, title, description);
                
                update(store => {
                    const updatedJournals = [...store.journals, newJournal];
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        journals: updatedJournals
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Update a journal
        updateJournal: async (journalId, updatedData) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                const { title, description } = updatedData;
                
                // Find the current journal to get existing data for any missing fields
                let currentJournal;
                
                // Use a temporary variable to access the store state
                let storeSnapshot = { journals: [] };
                update(state => {
                    storeSnapshot = state;
                    return state;
                });
                
                const journalIndex = storeSnapshot.journals.findIndex(journal => journal.id === journalId);
                
                if (journalIndex === -1) {
                    throw new Error('Journal not found');
                }
                
                currentJournal = storeSnapshot.journals[journalIndex];
                
                // Update the journal in Neo4j
                const updatedJournal = await notesService.updateJournal(
                    journalId,
                    title || currentJournal.title,
                    description || currentJournal.description
                );
                
                update(store => {
                    const updatedJournals = [...store.journals];
                    const journalIndex = updatedJournals.findIndex(journal => journal.id === journalId);
                    
                    if (journalIndex !== -1) {
                        updatedJournals[journalIndex] = updatedJournal;
                    }
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        journals: updatedJournals
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Delete a journal
        deleteJournal: async (journalId) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                // Delete the journal from Neo4j
                await notesService.deleteJournal(journalId);
                
                update(store => {
                    const updatedJournals = store.journals.filter(journal => journal.id !== journalId);
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        journals: updatedJournals
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Add a note to a journal
        addNoteToJournal: async (noteId, journalId) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                await notesService.addNoteToJournal(noteId, journalId);
                
                update(store => {
                    const updatedJournals = [...store.journals];
                    const journalIndex = updatedJournals.findIndex(journal => journal.id === journalId);
                    
                    if (journalIndex !== -1) {
                        const journal = updatedJournals[journalIndex];
                        
                        // Check if note is already in journal
                        if (!journal.noteIds.includes(noteId)) {
                            updatedJournals[journalIndex] = {
                                ...journal,
                                noteIds: [...journal.noteIds, noteId]
                            };
                        }
                    }
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        journals: updatedJournals
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Remove a note from a journal
        removeNoteFromJournal: async (noteId, journalId) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                await notesService.removeNoteFromJournal(noteId, journalId);
                
                update(store => {
                    const updatedJournals = [...store.journals];
                    const journalIndex = updatedJournals.findIndex(journal => journal.id === journalId);
                    
                    if (journalIndex !== -1) {
                        const journal = updatedJournals[journalIndex];
                        
                        updatedJournals[journalIndex] = {
                            ...journal,
                            noteIds: journal.noteIds.filter(id => id !== noteId)
                        };
                    }
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        journals: updatedJournals
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Add a tag to the system
        addTag: async (tagName) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                // No need to explicitly add tags to Neo4j, they are added via notes
                
                update(store => {
                    // Check if tag already exists
                    if (store.tags.includes(tagName)) {
                        return { ...store, state: noteStates.IDLE };
                    }
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        tags: [...store.tags, tagName]
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Remove a tag from the system
        removeTag: async (tagName) => {
            update(store => ({ ...store, state: noteStates.SAVING }));
            
            try {
                // In Neo4j we would need to update all notes that have this tag
                // For simplicity, we'll just update our local state
                // In a real app, you'd implement this in the backend
                
                update(store => {
                    const updatedTags = store.tags.filter(tag => tag !== tagName);
                    
                    // Also remove tag from all notes
                    const updatedNotes = store.notes.map(note => ({
                        ...note,
                        tags: note.tags.filter(tag => tag !== tagName)
                    }));
                    
                    return {
                        ...store,
                        state: noteStates.IDLE,
                        tags: updatedTags,
                        notes: updatedNotes,
                        filteredNotes: store.searchTerm 
                            ? updatedNotes.filter(note => 
                                note.title.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.content.toLowerCase().includes(store.searchTerm.toLowerCase()) ||
                                note.tags.some(tag => tag.toLowerCase().includes(store.searchTerm.toLowerCase()))
                            )
                            : updatedNotes
                    };
                });
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Search for notes based on a search term
        searchNotes: async (criteria) => {
            update(store => ({ ...store, state: noteStates.LOADING }));
            
            try {
                // If criteria is a string, convert to basic search object
                if (typeof criteria === 'string') {
                    criteria = {
                        query: criteria,
                        searchType: 'basic',
                        inTags: true,
                        inTitles: true,
                        inContent: true
                    };
                }
                
                // If no query provided, return all notes
                if (!criteria.query || criteria.query.trim() === '') {
                    let allNotes = [];
                    update(store => {
                        allNotes = store.notes;
                        return {
                            ...store,
                            state: noteStates.IDLE,
                            searchTerm: '',
                            filteredNotes: store.notes
                        };
                    });
                    return allNotes;
                }
                
                const authState = get(authStore);
                if (!authState.user) {
                    throw new Error('User not authenticated');
                }
                
                const userId = authState.user.id;
                
                // Use Neo4j for searching if implemented in the service
                let filteredNotes;
                
                try {
                    // First try to use advanced search if criteria has more than just a query
                    if ('advancedSearch' in notesService && 
                        (criteria.searchType !== 'basic' || 
                         criteria.dateFrom || 
                         criteria.dateTo || 
                         criteria.journalId)) {
                        filteredNotes = await notesService.advancedSearch(userId, criteria);
                    } else {
                        // Fall back to basic search if just a query string or advanced search not available
                        filteredNotes = await notesService.searchNotes(userId, criteria.query);
                    }
                } catch (error) {
                    // If that fails, fall back to client-side filtering
                    let currentNotes = [];
                    let currentJournals = [];
                    
                    update(s => {
                        currentNotes = s.notes;
                        currentJournals = s.journals;
                        return s;
                    });
                    
                    filteredNotes = currentNotes.filter(note => {
                        // Apply date filters if provided
                        if (criteria.dateFrom) {
                            const noteDate = new Date(note.updatedAt || note.createdAt);
                            if (noteDate < criteria.dateFrom) return false;
                        }
                        
                        if (criteria.dateTo) {
                            const noteDate = new Date(note.updatedAt || note.createdAt);
                            if (noteDate > criteria.dateTo) return false;
                        }
                        
                        // Apply journal filter if provided
                        if (criteria.journalId) {
                            const journal = currentJournals.find(j => j.id === criteria.journalId);
                            if (!journal || !journal.noteIds.includes(note.id)) return false;
                        }
                        
                        const query = criteria.query.toLowerCase();
                        
                        // Apply different search types
                        if (criteria.searchType === 'tags') {
                            return note.tags.some(tag => tag.toLowerCase().includes(query));
                        } else if (criteria.searchType === 'content') {
                            return note.content.toLowerCase().includes(query);
                        } else {
                            // Basic or advanced search
                            const matchesTitle = criteria.inTitles && note.title.toLowerCase().includes(query);
                            const matchesContent = criteria.inContent && note.content.toLowerCase().includes(query);
                            const matchesTags = criteria.inTags && note.tags.some(tag => tag.toLowerCase().includes(query));
                            
                            return matchesTitle || matchesContent || matchesTags;
                        }
                    });
                }
                
                update(store => ({
                    ...store,
                    state: noteStates.IDLE,
                    searchTerm: criteria.query,
                    filteredNotes
                }));
                
                return filteredNotes;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: noteStates.ERROR,
                    error: error.message
                }));
                return [];
            }
        },
        
        // Clear all error states
        clearError: () => {
            update(store => ({
                ...store,
                state: noteStates.IDLE,
                error: null
            }));
        }
    };
}

export const notesStore = createNotesStore(); 