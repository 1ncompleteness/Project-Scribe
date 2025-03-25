import neo4jService from './neo4j.service';

class NotesService {
    /**
     * Get all notes for a user
     */
    async getNotes(userId) {
        try {
            return await neo4jService.getNotesByUserId(userId);
        } catch (error) {
            console.error('Error fetching notes:', error);
            throw error;
        }
    }
    
    /**
     * Create a new note
     */
    async createNote(userId, title, content, tags = []) {
        try {
            return await neo4jService.createNote(userId, title, content, tags);
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }
    
    /**
     * Update a note
     */
    async updateNote(noteId, title, content, tags = []) {
        try {
            return await neo4jService.updateNote(noteId, title, content, tags);
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }
    
    /**
     * Delete a note
     */
    async deleteNote(noteId) {
        try {
            return await neo4jService.deleteNote(noteId);
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }
    
    /**
     * Search notes by term
     */
    async searchNotes(userId, searchTerm) {
        try {
            return await neo4jService.searchNotes(userId, searchTerm);
        } catch (error) {
            console.error('Error searching notes:', error);
            throw error;
        }
    }
    
    /**
     * Advanced search for notes with filtering options
     */
    async advancedSearch(userId, criteria) {
        try {
            return await neo4jService.advancedSearch(userId, criteria);
        } catch (error) {
            console.error('Error performing advanced search:', error);
            throw error;
        }
    }
    
    /**
     * Get all journals for a user
     */
    async getJournals(userId) {
        try {
            return await neo4jService.getJournalsByUserId(userId);
        } catch (error) {
            console.error('Error fetching journals:', error);
            throw error;
        }
    }
    
    /**
     * Create a journal
     */
    async createJournal(userId, title, description = '') {
        try {
            return await neo4jService.createJournal(userId, title, description);
        } catch (error) {
            console.error('Error creating journal:', error);
            throw error;
        }
    }
    
    /**
     * Update a journal
     */
    async updateJournal(journalId, title, description) {
        try {
            return await neo4jService.updateJournal(journalId, title, description);
        } catch (error) {
            console.error('Error updating journal:', error);
            throw error;
        }
    }
    
    /**
     * Delete a journal
     */
    async deleteJournal(journalId) {
        try {
            return await neo4jService.deleteJournal(journalId);
        } catch (error) {
            console.error('Error deleting journal:', error);
            throw error;
        }
    }
    
    /**
     * Add a note to a journal
     */
    async addNoteToJournal(noteId, journalId) {
        try {
            return await neo4jService.addNoteToJournal(noteId, journalId);
        } catch (error) {
            console.error('Error adding note to journal:', error);
            throw error;
        }
    }
    
    /**
     * Remove a note from a journal
     */
    async removeNoteFromJournal(noteId, journalId) {
        try {
            return await neo4jService.removeNoteFromJournal(noteId, journalId);
        } catch (error) {
            console.error('Error removing note from journal:', error);
            throw error;
        }
    }
    
    /**
     * Get all tags for a user
     */
    async getUserTags(userId) {
        try {
            return await neo4jService.getUserTags(userId);
        } catch (error) {
            console.error('Error fetching tags:', error);
            throw error;
        }
    }
}

const notesService = new NotesService();
export default notesService; 