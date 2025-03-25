<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { notesStore } from '../../stores/notes.store';
    import NoteCard from '../Notes/NoteCard.svelte';
    
    const dispatch = createEventDispatcher();
    
    let searchQuery = '';
    let searchResults = [];
    let isLoading = false;
    let searchError = null;
    let searchType = 'basic'; // 'basic', 'tags', 'content', 'advanced'
    let searchInTags = true;
    let searchInTitles = true;
    let searchInContent = true;
    let selectedJournalId = '';
    let dateFrom = '';
    let dateTo = '';
    
    // Reset form
    function resetSearch() {
        searchQuery = '';
        searchType = 'basic';
        searchInTags = true;
        searchInTitles = true;
        searchInContent = true;
        selectedJournalId = '';
        dateFrom = '';
        dateTo = '';
        searchResults = [];
    }
    
    // Handle search submission
    async function handleSearch() {
        isLoading = true;
        searchError = null;
        
        try {
            // Build search criteria
            const criteria = {
                query: searchQuery,
                searchType,
                inTags: searchInTags,
                inTitles: searchInTitles,
                inContent: searchInContent,
                journalId: selectedJournalId || null,
                dateFrom: dateFrom ? new Date(dateFrom) : null,
                dateTo: dateTo ? new Date(dateTo) : null
            };
            
            // Perform search via notes store
            searchResults = await notesStore.searchNotes(criteria);
        } catch (error) {
            console.error('Search error:', error);
            searchError = 'Failed to search notes. Please try again.';
            searchResults = [];
        } finally {
            isLoading = false;
        }
    }
    
    // Handle note selection
    function selectNote(noteId) {
        dispatch('select', { id: noteId });
    }
    
    // Listen for Enter key in search input
    function handleKeyDown(event) {
        if (event.key === 'Enter' && searchQuery.trim()) {
            handleSearch();
        }
    }
</script>

<div class="w-full h-full flex flex-col">
    <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Search Notes</h2>
        
        <!-- Search Input -->
        <div class="relative">
            <div class="flex">
                <input 
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Search for notes..." 
                    class="w-full px-4 py-2 rounded-l-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    on:keydown={handleKeyDown}
                />
                <button 
                    on:click={handleSearch} 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 transition-colors"
                    disabled={!searchQuery.trim() || isLoading}
                >
                    {#if isLoading}
                        <span class="flex items-center">
                            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Searching...
                        </span>
                    {:else}
                        Search
                    {/if}
                </button>
            </div>
        </div>
        
        <!-- Search Options -->
        <div class="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-medium text-gray-700 dark:text-gray-300">Search Options</h3>
                <button 
                    on:click={resetSearch}
                    class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                    Reset
                </button>
            </div>
            
            <!-- Search Type Selection -->
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Type</label>
                <div class="flex flex-wrap gap-2">
                    <label class="inline-flex items-center">
                        <input type="radio" bind:group={searchType} value="basic" class="form-radio text-indigo-600">
                        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Basic</span>
                    </label>
                    <label class="inline-flex items-center">
                        <input type="radio" bind:group={searchType} value="tags" class="form-radio text-indigo-600">
                        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Tags Only</span>
                    </label>
                    <label class="inline-flex items-center">
                        <input type="radio" bind:group={searchType} value="content" class="form-radio text-indigo-600">
                        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Content Only</span>
                    </label>
                    <label class="inline-flex items-center">
                        <input type="radio" bind:group={searchType} value="advanced" class="form-radio text-indigo-600">
                        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Advanced</span>
                    </label>
                </div>
            </div>
            
            {#if searchType === 'basic' || searchType === 'advanced'}
                <!-- Search Locations -->
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search In</label>
                    <div class="flex flex-wrap gap-2">
                        <label class="inline-flex items-center">
                            <input type="checkbox" bind:checked={searchInTitles} class="form-checkbox text-indigo-600">
                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Titles</span>
                        </label>
                        <label class="inline-flex items-center">
                            <input type="checkbox" bind:checked={searchInContent} class="form-checkbox text-indigo-600">
                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Content</span>
                        </label>
                        <label class="inline-flex items-center">
                            <input type="checkbox" bind:checked={searchInTags} class="form-checkbox text-indigo-600">
                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Tags</span>
                        </label>
                    </div>
                </div>
            {/if}
            
            {#if searchType === 'advanced'}
                <!-- Journal Filter -->
                <div class="mb-4">
                    <label for="journal" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Journal</label>
                    <select 
                        id="journal" 
                        bind:value={selectedJournalId} 
                        class="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">All Journals</option>
                        {#each $notesStore.journals as journal}
                            <option value={journal.id}>{journal.title}</option>
                        {/each}
                    </select>
                </div>
                
                <!-- Date Range -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label for="date-from" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
                        <input 
                            type="date" 
                            id="date-from" 
                            bind:value={dateFrom} 
                            class="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                    </div>
                    <div>
                        <label for="date-to" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
                        <input 
                            type="date" 
                            id="date-to" 
                            bind:value={dateTo} 
                            class="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                    </div>
                </div>
            {/if}
        </div>
    </div>
    
    <!-- Search Results -->
    <div class="flex-1 overflow-y-auto">
        {#if searchError}
            <div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
                <p>{searchError}</p>
            </div>
        {/if}
        
        {#if searchResults.length > 0}
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                Found {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
            </h3>
            
            <div class="space-y-3">
                {#each searchResults as note}
                    <div on:click={() => selectNote(note.id)} class="cursor-pointer">
                        <NoteCard {note} />
                    </div>
                {/each}
            </div>
        {:else if searchQuery && !isLoading}
            <div class="text-center py-8">
                <p class="text-gray-500 dark:text-gray-400">No notes found matching your search criteria.</p>
            </div>
        {/if}
    </div>
</div>

<style>
    /* Add any component-specific styles here */
    input[type="radio"], input[type="checkbox"] {
        height: 1rem;
        width: 1rem;
        color: #4f46e5;
        border-color: #d1d5db;
        border-radius: 0.25rem;
    }
    
    input[type="radio"]:focus, input[type="checkbox"]:focus {
        --tw-ring-color: #4f46e5;
        --tw-ring-offset-width: 2px;
    }
</style> 