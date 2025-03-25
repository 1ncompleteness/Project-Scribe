<script>
    import { createEventDispatcher } from 'svelte';
    import neo4jService from '../../services/neo4j.service';
    
    export let darkMode = false;
    export let fontSize = 'medium'; // small, medium, large
    
    const dispatch = createEventDispatcher();
    
    // Toggle dark mode
    const toggleDarkMode = () => {
        dispatch('toggleDarkMode');
    };
    
    // Change font size
    const changeFontSize = (size) => {
        fontSize = size;
        dispatch('changeFontSize', { size });
    };
    
    // Reset database (only for development)
    const resetDatabase = async () => {
        if (confirm('Are you sure you want to reset the database? This will delete ALL data!')) {
            try {
                // Call the reset method on the neo4j service
                const resetQuery = `
                    MATCH (n)
                    DETACH DELETE n
                `;
                await neo4jService.runQuery(resetQuery);
                
                // Reinitialize constraints and indexes
                await neo4jService.initializeDatabase();
                
                alert('Database reset successful. Please refresh the page.');
            } catch (error) {
                alert(`Error resetting database: ${error.message}`);
            }
        }
    };
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
    <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-6">Settings</h2>
    
    <!-- Appearance section -->
    <div class="mb-8">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Appearance</h3>
        
        <!-- Dark Mode Toggle -->
        <div class="flex items-center justify-between mb-4">
            <span class="text-gray-700 dark:text-gray-300">Dark Mode</span>
            <button 
                class="w-12 h-6 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500"
                on:click={toggleDarkMode}
                aria-checked={darkMode}
                role="switch"
            >
                <span 
                    class="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 absolute" 
                    style="left: {darkMode ? '28px' : '2px'}"
                ></span>
            </button>
        </div>
        
        <!-- Font Size -->
        <div class="mb-4">
            <span class="block text-gray-700 dark:text-gray-300 mb-2">Font Size</span>
            <div class="flex space-x-2">
                <button 
                    class="px-3 py-1 rounded {fontSize === 'small' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    on:click={() => changeFontSize('small')}
                >
                    Small
                </button>
                <button 
                    class="px-3 py-1 rounded {fontSize === 'medium' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    on:click={() => changeFontSize('medium')}
                >
                    Medium
                </button>
                <button 
                    class="px-3 py-1 rounded {fontSize === 'large' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    on:click={() => changeFontSize('large')}
                >
                    Large
                </button>
            </div>
        </div>
    </div>
    
    <!-- Application Settings -->
    <div class="mb-8">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Application</h3>
        
        <!-- Database Connection -->
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-gray-700 dark:text-gray-300">Database Connection</span>
                <span class="flex items-center text-sm">
                    <span 
                        class="w-3 h-3 rounded-full mr-2 {neo4jService.isConnected() ? 'bg-green-500' : 'bg-red-500'}"
                    ></span>
                    {neo4jService.isConnected() ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <button 
                class="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                on:click={() => window.location.reload()}
            >
                Reconnect to Database
            </button>
        </div>
    </div>
    
    <!-- Developer Options (only in development) -->
    <div class="mb-8">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Developer Options</h3>
        
        <div class="mb-4">
            <button 
                class="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                on:click={resetDatabase}
            >
                Reset Database
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Warning: This will erase all data in the database.
            </p>
        </div>
    </div>
    
    <div class="text-sm text-gray-500 dark:text-gray-400">
        <p>The Scribe Project v1.0.0</p>
        <p>© 2023 Scribe Project Team</p>
    </div>
</div> 