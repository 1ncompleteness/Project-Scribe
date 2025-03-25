<script>
    import { createEventDispatcher } from 'svelte';
    import { authStore } from '../../stores/auth.store';
    import neo4jService from '../../services/neo4j.service';
    
    export let darkMode = false;
    
    const dispatch = createEventDispatcher();
    
    const toggleDarkMode = () => {
        dispatch('toggleDarkMode');
    };
    
    const logout = () => {
        authStore.logout();
    };
    
    const createNewNote = () => {
        dispatch('newNote');
    };
    
    // Get database connection status
    $: isDbConnected = neo4jService.isConnected();
</script>

<nav class="bg-indigo-700 text-white shadow-md py-3 px-4">
    <div class="container mx-auto flex justify-between items-center">
        <div class="flex items-center">
            <h1 class="text-xl font-bold">The Scribe Project</h1>
            <div class="ml-4 flex items-center">
                <div class="w-3 h-3 rounded-full {isDbConnected ? 'bg-green-400' : 'bg-red-500'} mr-2"></div>
                <span class="text-xs font-medium">{isDbConnected ? 'DB Connected' : 'DB Disconnected'}</span>
            </div>
        </div>
        
        <div class="flex items-center space-x-4">
            <button 
                on:click={createNewNote}
                class="px-3 py-1 rounded bg-white text-indigo-700 hover:bg-indigo-100 text-sm font-medium"
            >
                New Note
            </button>
            
            <button
                on:click={toggleDarkMode}
                class="text-white hover:text-indigo-200"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {#if darkMode}
                    <!-- Sun icon for light mode -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                {:else}
                    <!-- Moon icon for dark mode -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                {/if}
            </button>
            
            <div class="relative group">
                <button 
                    class="flex items-center space-x-1 hover:text-indigo-200"
                    aria-label="User menu"
                >
                    <span>{$authStore.user ? $authStore.user.username : 'Guest'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                <div class="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                    <a href="#settings" class="block px-4 py-2 hover:bg-indigo-100">Settings</a>
                    <button
                        on:click={logout}
                        class="block w-full text-left px-4 py-2 hover:bg-indigo-100"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    </div>
</nav> 