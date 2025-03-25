import { writable } from 'svelte/store';
import authService from '../services/auth.service';
import neo4jService from '../services/neo4j.service';

// User authentication states
export const authStates = {
    LOGGED_OUT: 'logged_out',
    LOGGING_IN: 'logging_in',
    REGISTERING: 'registering',
    LOGGED_IN: 'logged_in',
    ERROR: 'error',
    CONNECTING: 'connecting', // New state for DB connection
    CONNECTION_ERROR: 'connection_error' // New state for DB connection error
};

// Create the authentication store
function createAuthStore() {
    const { subscribe, set, update } = writable({
        state: authStates.LOGGED_OUT,
        user: null,
        error: null,
        dbConnected: false
    });

    return {
        subscribe,
        
        // Check Neo4j connection
        checkConnection: async () => {
            update(store => ({ 
                ...store, 
                state: authStates.CONNECTING,
                error: null
            }));
            
            try {
                const connected = await neo4jService.connect();
                
                update(store => ({
                    ...store,
                    dbConnected: connected,
                    state: connected ? store.state : authStates.CONNECTION_ERROR,
                    error: connected ? null : 'Could not connect to database'
                }));
                
                return connected;
            } catch (error) {
                update(store => ({
                    ...store,
                    dbConnected: false,
                    state: authStates.CONNECTION_ERROR,
                    error: error.message || 'Database connection error'
                }));
                
                return false;
            }
        },
        
        // Login functionality
        login: async (username, password) => {
            update(store => ({ ...store, state: authStates.LOGGING_IN, error: null }));
            
            try {
                // Check connection first
                const connected = neo4jService.isConnected() || await neo4jService.connect();
                if (!connected) {
                    throw new Error('Database connection failed');
                }
                
                // Login using auth service
                const user = await authService.login(username, password);
                
                // Save user session
                localStorage.setItem('user', JSON.stringify(user));
                
                update(store => ({
                    ...store,
                    state: authStates.LOGGED_IN,
                    user,
                    dbConnected: true
                }));
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: authStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Register functionality
        register: async (username, password) => {
            update(store => ({ ...store, state: authStates.REGISTERING, error: null }));
            
            try {
                // Check connection first
                const connected = neo4jService.isConnected() || await neo4jService.connect();
                if (!connected) {
                    throw new Error('Database connection failed');
                }
                
                // Register using auth service
                const user = await authService.register(username, password);
                
                // Save user session
                localStorage.setItem('user', JSON.stringify(user));
                
                update(store => ({
                    ...store,
                    state: authStates.LOGGED_IN,
                    user,
                    dbConnected: true
                }));
                
                return true;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: authStates.ERROR,
                    error: error.message
                }));
                return false;
            }
        },
        
        // Logout functionality
        logout: () => {
            localStorage.removeItem('user');
            set({
                state: authStates.LOGGED_OUT,
                user: null,
                error: null,
                dbConnected: neo4jService.isConnected()
            });
        },
        
        // Check if user is already logged in from localStorage
        checkAuth: async () => {
            const userStr = localStorage.getItem('user');
            
            // Connect to database first
            await neo4jService.connect();
            
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    update(store => ({
                        ...store,
                        state: authStates.LOGGED_IN,
                        user,
                        dbConnected: neo4jService.isConnected()
                    }));
                } catch (e) {
                    localStorage.removeItem('user');
                }
            } else {
                update(store => ({
                    ...store,
                    dbConnected: neo4jService.isConnected()
                }));
            }
        }
    };
}

export const authStore = createAuthStore(); 