<script>
    import { onMount } from 'svelte';
    import { notesStore } from '../../stores/notes.store';
    import { aiStore } from '../../stores/ai.store';
    import { authStore } from '../../stores/auth.store';
    import Navbar from '../Layout/Navbar.svelte';
    import Sidebar from '../Layout/Sidebar.svelte';
    import NoteCard from '../Notes/NoteCard.svelte';
    import NoteEditor from '../Notes/NoteEditor.svelte';
    import JournalManager from '../Journals/JournalManager.svelte';
    import SettingsPanel from '../Settings/SettingsPanel.svelte';
    import AgnisChatPanel from '../AI/AgnisChatPanel.svelte';
    import SearchPanel from '../Search/SearchPanel.svelte';
    import SearchBar from '../Search/SearchBar.svelte';
    
    let darkMode = false;
    let fontSize = 'medium';
    let currentNoteId = null;
    let currentJournalId = null;
    let isCreatingNote = false;
    let activeSection = 'notes'; // notes, journals, settings, ai
    
    // Initialize data
    onMount(() => {
        notesStore.init();
        
        // Check if there's a theme preference in localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            darkMode = true;
            document.documentElement.classList.add('dark');
        }
        
        // Check if there's a font size preference
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
            fontSize = savedFontSize;
            applyFontSize(fontSize);
        }
    });
    
    // Toggle between light and dark mode
    const toggleDarkMode = () => {
        darkMode = !darkMode;
        
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };
    
    // Change font size
    const changeFontSize = (event) => {
        fontSize = event.detail.size;
        localStorage.setItem('fontSize', fontSize);
        applyFontSize(fontSize);
    };
    
    // Apply font size to document
    function applyFontSize(size) {
        const htmlElement = document.documentElement;
        
        // Remove existing font size classes
        htmlElement.classList.remove('text-sm', 'text-base', 'text-lg');
        
        // Add the appropriate class
        switch (size) {
            case 'small':
                htmlElement.classList.add('text-sm');
                break;
            case 'medium':
                htmlElement.classList.add('text-base');
                break;
            case 'large':
                htmlElement.classList.add('text-lg');
                break;
        }
    }
    
    // Create a new note
    const createNewNote = () => {
        currentNoteId = null;
        isCreatingNote = true;
        activeSection = 'notes';
    };
    
    // Handle note selection
    const handleNoteSelect = (event) => {
        currentNoteId = event.detail.id;
        isCreatingNote = false;
        activeSection = 'notes'; // Always switch to notes section when selecting a note
    };
    
    // Handle journal selection
    const handleJournalSelect = (event) => {
        currentJournalId = event.detail.id;
        activeSection = 'notes';
    };
    
    // Handle note creation completion
    const handleNoteCreated = (event) => {
        currentNoteId = event.detail.id;
        isCreatingNote = false;
    };
    
    // Handle section change from sidebar
    const handleSectionChange = (event) => {
        activeSection = event.detail.section;
    };
    
    // Handle create note from AI
    const handleCreateNoteFromAI = (event) => {
        const { title, content } = event.detail;
        
        // Create a new note with the generated content
        notesStore.createNote(title, content).then(success => {
            if (success) {
                // Switch to notes section and select the new note
                activeSection = 'notes';
                currentNoteId = $notesStore.currentNote.id;
                isCreatingNote = false;
            }
        });
    };
    
    // Filter notes based on selected journal
    $: filteredNotes = currentJournalId
        ? $notesStore.filteredNotes.filter(note => {
            const journal = $notesStore.journals.find(j => j.id === currentJournalId);
            return journal && journal.noteIds.includes(note.id);
        })
        : $notesStore.filteredNotes;
</script>

<div class="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <Navbar 
        {darkMode} 
        on:toggleDarkMode={toggleDarkMode} 
        on:newNote={createNewNote} 
    />
    
    <div class="flex-grow flex overflow-hidden">
        <!-- Sidebar -->
        <Sidebar 
            activeSection={activeSection} 
            on:changeSection={handleSectionChange} 
        />
        
        <!-- Main Content Area -->
        <div class="flex-1 overflow-hidden flex flex-col">
            {#if activeSection === 'notes'}
                <!-- Notes Section -->
                <div class="flex-1 flex overflow-hidden">
                    <!-- Note List -->
                    <div class="w-80 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                {#if currentJournalId}
                                    {$notesStore.journals.find(j => j.id === currentJournalId)?.title || 'Notes'}
                                {:else}
                                    All Notes
                                {/if}
                            </h2>
                            
                            <div class="flex items-center">
                                <span class="text-sm text-gray-500 dark:text-gray-400 mr-2">
                                    {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
                                </span>
                                <button
                                    on:click={createNewNote}
                                    class="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                                    title="Create new note"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <SearchBar 
                                on:search={(event) => notesStore.searchNotes(event.detail.query)}
                                on:clear={() => notesStore.searchNotes('')}
                            />
                        </div>
                        
                        {#if filteredNotes.length === 0}
                            <div class="text-center py-8">
                                <p class="text-gray-500 dark:text-gray-400">No notes found. Create one!</p>
                                <button
                                    on:click={createNewNote}
                                    class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                    Create Note
                                </button>
                            </div>
                        {:else}
                            <div class="space-y-3">
                                {#each filteredNotes as note (note.id)}
                                    <NoteCard 
                                        {note}
                                        on:select={handleNoteSelect}
                                    />
                                {/each}
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Editor Area -->
                    <div class="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                        {#if isCreatingNote || currentNoteId}
                            <NoteEditor 
                                noteId={currentNoteId}
                                on:created={handleNoteCreated}
                            />
                        {:else}
                            <div class="h-full flex items-center justify-center">
                                <div class="text-center">
                                    <h2 class="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Welcome to The Scribe Project</h2>
                                    <p class="text-gray-600 dark:text-gray-400 mb-6">Select a note to edit or create a new one</p>
                                    <button
                                        on:click={createNewNote}
                                        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                    >
                                        Create New Note
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            {:else if activeSection === 'journals'}
                <!-- Journals Management Section -->
                <div class="flex-1 p-6 overflow-y-auto">
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-6">Journal Management</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <JournalManager 
                            activeJournalId={currentJournalId}
                            on:select={handleJournalSelect}
                        />
                        
                        <!-- Journal Content Preview -->
                        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                                {#if currentJournalId}
                                    {$notesStore.journals.find(j => j.id === currentJournalId)?.title || 'Journal Preview'}
                                {:else}
                                    Journal Preview
                                {/if}
                            </h3>
                            
                            {#if currentJournalId}
                                {#if filteredNotes.length === 0}
                                    <p class="text-gray-500 dark:text-gray-400">This journal has no notes yet.</p>
                                {:else}
                                    <div class="space-y-3 max-h-96 overflow-y-auto">
                                        {#each filteredNotes as note (note.id)}
                                            <NoteCard 
                                                {note}
                                                on:select={handleNoteSelect}
                                            />
                                        {/each}
                                    </div>
                                {/if}
                            {:else}
                                <p class="text-gray-500 dark:text-gray-400">Select a journal to view its notes</p>
                            {/if}
                        </div>
                    </div>
                </div>
            {:else if activeSection === 'settings'}
                <!-- Settings Section -->
                <div class="flex-1 p-6 overflow-y-auto">
                    <SettingsPanel 
                        {darkMode} 
                        {fontSize}
                        on:toggleDarkMode={toggleDarkMode}
                        on:changeFontSize={changeFontSize}
                    />
                </div>
            {:else if activeSection === 'ai'}
                <!-- AI Assistant Section -->
                <div class="flex-1 p-6 overflow-hidden">
                    <AgnisChatPanel on:createNote={handleCreateNoteFromAI} />
                </div>
            {:else if activeSection === 'search'}
                <!-- Search Section -->
                <div class="flex-1 p-6 overflow-y-auto">
                    <SearchPanel on:select={handleNoteSelect} />
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    :global(body) {
        @apply transition-colors duration-200;
    }
    
    :global(.dark) {
        @apply text-gray-100;
    }
</style> 