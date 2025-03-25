import neo4jService from './neo4j.service';

// Simple password hashing function (in a real app, use bcrypt or similar)
const hashPassword = (password) => {
    // For a real application, use a proper hashing library
    // This is a simple hash just for demonstration
    return btoa(password + '_hashed');
};

// Verify password
const verifyPassword = (password, hashedPassword) => {
    return hashPassword(password) === hashedPassword;
};

class AuthService {
    /**
     * Register a new user
     */
    async register(username, password) {
        try {
            // Check if user already exists
            const existingUser = await neo4jService.getUserByUsername(username);
            if (existingUser) {
                throw new Error('Username already exists');
            }
            
            // Hash password and create user
            const passwordHash = hashPassword(password);
            const user = await neo4jService.createUser(username, passwordHash);
            
            return user;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    
    /**
     * Login a user
     */
    async login(username, password) {
        try {
            // Get user from Neo4j
            const query = `
                MATCH (u:User)
                WHERE u.username = $username
                RETURN u
            `;
            
            const records = await neo4jService.runQuery(query, { username });
            
            if (records.length === 0) {
                throw new Error('Invalid username or password');
            }
            
            const user = records[0].get('u').properties;
            
            // Verify password
            if (!verifyPassword(password, user.passwordHash)) {
                throw new Error('Invalid username or password');
            }
            
            // Don't return the password hash to the client
            const { passwordHash, ...userWithoutPassword } = user;
            
            return userWithoutPassword;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
}

const authService = new AuthService();
export default authService; 