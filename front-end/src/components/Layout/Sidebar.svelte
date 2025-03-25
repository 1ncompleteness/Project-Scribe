<script>
    import { createEventDispatcher } from 'svelte';
    import SearchBar from '../Search/SearchBar.svelte';
    import neo4jService from '../../services/neo4j.service';
    
    export let activeSection = 'notes'; // notes, journals, settings, ai
    
    const dispatch = createEventDispatcher();
    
    // Set active section
    const setActive = (section) => {
        dispatch('changeSection', { section });
    };
    
    // Check database connection status
    $: isConnected = neo4jService.isConnected();
</script>

<div class="w-64 h-full bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <!-- Sidebar header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-lg font-bold text-indigo-700 dark:text-indigo-300">Scribe Project</h1>
        <div class="flex items-center mt-2 text-xs">
            <div class="w-2 h-2 rounded-full {isConnected ? 'bg-green-500' : 'bg-red-500'} mr-2"></div>
            <span class="text-gray-600 dark:text-gray-300">
                {isConnected ? 'Database Connected' : 'Offline Mode'}
            </span>
        </div>
    </div>
    
    <!-- Sidebar content -->
    <div class="flex-1 overflow-y-auto p-4">
        <!-- Search section -->
        <div class="mb-6">
            <SearchBar />
        </div>
        
        <!-- Navigation -->
        <nav class="mb-6">
            <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Navigation</h2>
            <ul class="space-y-1">
                <li>
                    <button 
                        class="w-full flex items-center px-3 py-2 rounded-md transition-colors {activeSection === 'notes' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}" 
                        on:click={() => setActive('notes')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Notes
                    </button>
                </li>
                <li>
                    <button 
                        class="w-full flex items-center px-3 py-2 rounded-md transition-colors {activeSection === 'journals' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                        on:click={() => setActive('journals')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        Journals
                    </button>
                </li>
                <li>
                    <button 
                        class="w-full flex items-center px-3 py-2 rounded-md transition-colors {activeSection === 'ai' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                        on:click={() => setActive('ai')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AGNIS Assistant
                    </button>
                </li>
            </ul>
        </nav>
        
        <!-- Tags section 
        <div class="mb-6">
            <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tags</h2>
            <div class="flex flex-wrap gap-2">
                {#each $notesStore.tags as tag}
                    <span class="px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {tag}
                    </span>
                {/each}
            </div>
        </div>
        -->
    </div>
    
    <!-- Sidebar footer with settings -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <button 
            class="w-full flex items-center px-3 py-2 rounded-md transition-colors {activeSection === 'settings' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            on:click={() => setActive('settings')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
        </button>
    </div>
</div> 