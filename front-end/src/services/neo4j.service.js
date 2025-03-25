import neo4j from 'neo4j-driver';

// Neo4j connection configuration
const NEO4J_URI = import.meta.env.VITE_NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USER = import.meta.env.VITE_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = import.meta.env.VITE_NEO4J_PASSWORD || 'password';

class Neo4jService {
    constructor() {
        this.driver = null;
        this.session = null;
        this._isConnected = false;
    }

    /**
     * Initialize connection to Neo4j
     */
    async connect() {
        try {
            this.driver = neo4j.driver(
                NEO4J_URI,
                neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
            );

            // Verify connection
            await this.driver.verifyConnectivity();
            this._isConnected = true;

            // Initialize database with constraints if they don't exist
            await this.initializeDatabase();
            
            console.log('Connected to Neo4j database');
            return true;
        } catch (error) {
            console.error('Failed to connect to Neo4j:', error);
            this._isConnected = false;
            return false;
        }
    }

    /**
     * Check if currently connected to Neo4j
     */
    isConnected() {
        return this._isConnected;
    }

    /**
     * Close the Neo4j connection
     */
    close() {
        if (this.driver) {
            this.driver.close();
            this._isConnected = false;
        }
    }

    /**
     * Create session for transaction
     */
    getSession() {
        if (!this.driver) {
            throw new Error('Not connected to Neo4j');
        }
        return this.driver.session();
    }

    /**
     * Run a query with parameters
     */
    async runQuery(query, params = {}) {
        if (!this.driver) {
            throw new Error('Not connected to Neo4j');
        }

        const session = this.getSession();
        try {
            const result = await session.run(query, params);
            return result.records;
        } finally {
            session.close();
        }
    }

    /**
     * Initialize database with constraints and indexes
     */
    async initializeDatabase() {
        // Create constraints for users (unique username)
        await this.runQuery(`
            CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) 
            REQUIRE u.username IS UNIQUE
        `);

        // Create constraints for notes (unique id)
        await this.runQuery(`
            CREATE CONSTRAINT IF NOT EXISTS FOR (n:Note) 
            REQUIRE n.id IS UNIQUE
        `);

        // Create constraints for journals (unique id)
        await this.runQuery(`
            CREATE CONSTRAINT IF NOT EXISTS FOR (j:Journal) 
            REQUIRE j.id IS UNIQUE
        `);

        // Create indexes for tags
        await this.runQuery(`
            CREATE INDEX IF NOT EXISTS FOR (t:Tag) 
            ON (t.name)
        `);
    }

    /**
     * User Management Methods
     */

    // Create a new user
    async createUser(username, passwordHash) {
        const query = `
            CREATE (u:User {
                id: randomUUID(),
                username: $username,
                passwordHash: $passwordHash,
                createdAt: datetime()
            })
            RETURN u
        `;
        
        const records = await this.runQuery(query, { username, passwordHash });
        return records.length > 0 ? this.formatUserRecord(records[0].get('u')) : null;
    }

    // Get user by username
    async getUserByUsername(username) {
        const query = `
            MATCH (u:User)
            WHERE u.username = $username
            RETURN u
        `;
        
        const records = await this.runQuery(query, { username });
        return records.length > 0 ? this.formatUserRecord(records[0].get('u')) : null;
    }

    /**
     * Note Management Methods
     */

    // Create a new note
    async createNote(userId, title, content, tags = []) {
        const query = `
            MATCH (u:User {id: $userId})
            CREATE (n:Note {
                id: randomUUID(),
                title: $title,
                content: $content,
                createdAt: datetime(),
                updatedAt: datetime()
            })
            CREATE (u)-[:CREATED]->(n)
            WITH n
            UNWIND $tags as tagName
            MERGE (t:Tag {name: tagName})
            CREATE (n)-[:HAS_TAG]->(t)
            RETURN n
        `;
        
        const records = await this.runQuery(query, { 
            userId, 
            title, 
            content, 
            tags 
        });
        
        return records.length > 0 ? this.formatNoteRecord(records[0].get('n')) : null;
    }

    // Get all notes for a user
    async getNotesByUserId(userId) {
        const query = `
            MATCH (u:User {id: $userId})-[:CREATED]->(n:Note)
            OPTIONAL MATCH (n)-[:HAS_TAG]->(t:Tag)
            RETURN n, collect(t.name) as tags
        `;
        
        const records = await this.runQuery(query, { userId });
        return records.map(record => {
            const note = this.formatNoteRecord(record.get('n'));
            note.tags = record.get('tags');
            return note;
        });
    }

    // Get note by ID
    async getNoteById(noteId) {
        const query = `
            MATCH (n:Note {id: $noteId})
            OPTIONAL MATCH (n)-[:HAS_TAG]->(t:Tag)
            RETURN n, collect(t.name) as tags
        `;
        
        const records = await this.runQuery(query, { noteId });
        if (records.length === 0) return null;
        
        const note = this.formatNoteRecord(records[0].get('n'));
        note.tags = records[0].get('tags');
        return note;
    }

    // Update a note
    async updateNote(noteId, title, content, tags = []) {
        const query = `
            MATCH (n:Note {id: $noteId})
            SET n.title = $title, n.content = $content, n.updatedAt = datetime()
            WITH n
            
            // Remove old tags
            OPTIONAL MATCH (n)-[r:HAS_TAG]->(:Tag)
            DELETE r
            
            // Add new tags
            WITH n
            UNWIND $tags as tagName
            MERGE (t:Tag {name: tagName})
            CREATE (n)-[:HAS_TAG]->(t)
            
            RETURN n
        `;
        
        const records = await this.runQuery(query, { 
            noteId, 
            title, 
            content, 
            tags 
        });
        
        return records.length > 0 ? this.formatNoteRecord(records[0].get('n')) : null;
    }

    // Delete a note
    async deleteNote(noteId) {
        const query = `
            MATCH (n:Note {id: $noteId})
            DETACH DELETE n
        `;
        
        await this.runQuery(query, { noteId });
        return true;
    }

    /**
     * Journal Management Methods
     */

    // Create a new journal
    async createJournal(userId, title, description = '') {
        const query = `
            MATCH (u:User {id: $userId})
            CREATE (j:Journal {
                id: randomUUID(),
                title: $title,
                description: $description,
                createdAt: datetime(),
                updatedAt: datetime()
            })
            CREATE (u)-[:OWNS]->(j)
            RETURN j
        `;
        
        const records = await this.runQuery(query, { 
            userId, 
            title, 
            description 
        });
        
        return records.length > 0 ? this.formatJournalRecord(records[0].get('j')) : null;
    }

    // Get all journals for a user
    async getJournalsByUserId(userId) {
        const query = `
            MATCH (u:User {id: $userId})-[:OWNS]->(j:Journal)
            OPTIONAL MATCH (j)-[:CONTAINS]->(n:Note)
            RETURN j, collect(n.id) as noteIds
        `;
        
        const records = await this.runQuery(query, { userId });
        return records.map(record => {
            const journal = this.formatJournalRecord(record.get('j'));
            journal.noteIds = record.get('noteIds');
            return journal;
        });
    }

    // Update a journal
    async updateJournal(journalId, title, description) {
        const query = `
            MATCH (j:Journal {id: $journalId})
            SET j.title = $title, j.description = $description, j.updatedAt = datetime()
            RETURN j
        `;
        
        const records = await this.runQuery(query, { 
            journalId, 
            title, 
            description 
        });
        
        return records.length > 0 ? this.formatJournalRecord(records[0].get('j')) : null;
    }

    // Delete a journal
    async deleteJournal(journalId) {
        const query = `
            MATCH (j:Journal {id: $journalId})
            DETACH DELETE j
        `;
        
        await this.runQuery(query, { journalId });
        return true;
    }

    // Add note to journal
    async addNoteToJournal(noteId, journalId) {
        const query = `
            MATCH (n:Note {id: $noteId})
            MATCH (j:Journal {id: $journalId})
            MERGE (j)-[r:CONTAINS]->(n)
            SET j.updatedAt = datetime()
            RETURN j, n
        `;
        
        await this.runQuery(query, { noteId, journalId });
        return true;
    }

    // Remove note from journal
    async removeNoteFromJournal(noteId, journalId) {
        const query = `
            MATCH (j:Journal {id: $journalId})-[r:CONTAINS]->(n:Note {id: $noteId})
            DELETE r
            SET j.updatedAt = datetime()
            RETURN j
        `;
        
        await this.runQuery(query, { noteId, journalId });
        return true;
    }

    /**
     * Tag Management Methods
     */

    // Get all tags
    async getAllTags() {
        const query = `
            MATCH (t:Tag)
            RETURN t.name as tagName
        `;
        
        const records = await this.runQuery(query);
        return records.map(record => record.get('tagName'));
    }

    // Get user's tags
    async getUserTags(userId) {
        const query = `
            MATCH (u:User {id: $userId})-[:CREATED]->(n:Note)-[:HAS_TAG]->(t:Tag)
            RETURN DISTINCT t.name as tagName
        `;
        
        const records = await this.runQuery(query, { userId });
        return records.map(record => record.get('tagName'));
    }

    /**
     * Search Methods
     */

    // Search notes by text (title, content, tags)
    async searchNotes(userId, searchTerm) {
        const query = `
            MATCH (u:User {id: $userId})-[:CREATED]->(n:Note)
            WHERE toLower(n.title) CONTAINS toLower($searchTerm) OR 
                  toLower(n.content) CONTAINS toLower($searchTerm) OR
                  EXISTS {
                      MATCH (n)-[:HAS_TAG]->(t:Tag)
                      WHERE toLower(t.name) CONTAINS toLower($searchTerm)
                  }
            OPTIONAL MATCH (n)-[:HAS_TAG]->(t:Tag)
            RETURN n, collect(t.name) as tags
        `;
        
        const records = await this.runQuery(query, { userId, searchTerm });
        return records.map(record => {
            const note = this.formatNoteRecord(record.get('n'));
            note.tags = record.get('tags');
            return note;
        });
    }
    
    // Advanced search with filtering options
    async advancedSearch(userId, criteria) {
        let whereClause = '';
        const params = { userId };
        
        // Handle different search types
        if (criteria.query && criteria.query.trim() !== '') {
            params.searchTerm = criteria.query.trim();
            
            if (criteria.searchType === 'tags') {
                whereClause = `
                    EXISTS {
                        MATCH (n)-[:HAS_TAG]->(t:Tag)
                        WHERE toLower(t.name) CONTAINS toLower($searchTerm)
                    }
                `;
            } else if (criteria.searchType === 'content') {
                whereClause = `toLower(n.content) CONTAINS toLower($searchTerm)`;
            } else {
                // Basic or advanced search with specific fields
                const conditions = [];
                
                if (criteria.inTitles) {
                    conditions.push(`toLower(n.title) CONTAINS toLower($searchTerm)`);
                }
                
                if (criteria.inContent) {
                    conditions.push(`toLower(n.content) CONTAINS toLower($searchTerm)`);
                }
                
                if (criteria.inTags) {
                    conditions.push(`
                        EXISTS {
                            MATCH (n)-[:HAS_TAG]->(t:Tag)
                            WHERE toLower(t.name) CONTAINS toLower($searchTerm)
                        }
                    `);
                }
                
                whereClause = conditions.join(' OR ');
            }
        }
        
        // Date range filtering
        if (criteria.dateFrom) {
            params.dateFrom = criteria.dateFrom.toISOString();
            whereClause += (whereClause ? ' AND ' : '') + `n.updatedAt >= datetime($dateFrom)`;
        }
        
        if (criteria.dateTo) {
            params.dateTo = criteria.dateTo.toISOString();
            whereClause += (whereClause ? ' AND ' : '') + `n.updatedAt <= datetime($dateTo)`;
        }
        
        // Journal filtering
        let journalMatch = '';
        if (criteria.journalId) {
            params.journalId = criteria.journalId;
            journalMatch = `
                MATCH (j:Journal {id: $journalId})-[:CONTAINS]->(n)
            `;
        }
        
        // Build the query
        const query = `
            MATCH (u:User {id: $userId})-[:CREATED]->(n:Note)
            ${journalMatch}
            ${whereClause ? `WHERE ${whereClause}` : ''}
            OPTIONAL MATCH (n)-[:HAS_TAG]->(t:Tag)
            RETURN n, collect(t.name) as tags
            ORDER BY n.updatedAt DESC
        `;
        
        const records = await this.runQuery(query, params);
        return records.map(record => {
            const note = this.formatNoteRecord(record.get('n'));
            note.tags = record.get('tags');
            return note;
        });
    }

    /**
     * Helper methods for formatting Neo4j records
     */
    
    formatUserRecord(userNode) {
        const user = userNode.properties;
        delete user.passwordHash; // Don't return password hash to the client
        return user;
    }
    
    formatNoteRecord(noteNode) {
        const note = noteNode.properties;
        
        // Convert Neo4j datetime to ISO string
        if (note.createdAt) {
            note.createdAt = note.createdAt.toString();
        }
        if (note.updatedAt) {
            note.updatedAt = note.updatedAt.toString();
        }
        
        return note;
    }
    
    formatJournalRecord(journalNode) {
        const journal = journalNode.properties;
        
        // Convert Neo4j datetime to ISO string
        if (journal.createdAt) {
            journal.createdAt = journal.createdAt.toString();
        }
        if (journal.updatedAt) {
            journal.updatedAt = journal.updatedAt.toString();
        }
        
        return journal;
    }
}

// Singleton instance
const neo4jService = new Neo4jService();
export default neo4jService; 