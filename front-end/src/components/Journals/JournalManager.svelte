<script>
    import { createEventDispatcher } from 'svelte';
    import { notesStore, noteStates } from '../../stores/notes.store';
    import JournalItem from './JournalItem.svelte';
    
    export let activeJournalId = null;
    
    let showCreateForm = false;
    let newJournalTitle = '';
    let newJournalDescription = '';
    let errorMessage = '';
    
    const dispatch = createEventDispatcher();
    
    // Create a new journal
    const createJournal = async () => {
        if (!newJournalTitle.trim()) {
            errorMessage = 'Please enter a title for your journal';
            return;
        }
        
        try {
            const result = await notesStore.createJournal(
                newJournalTitle.trim(), 
                newJournalDescription.trim()
            );
            
            if (result) {
                // Reset form
                newJournalTitle = '';
                newJournalDescription = '';
                errorMessage = '';
                showCreateForm = false;
                
                // Select the newly created journal
                const newJournal = $notesStore.journals.find(j => 
                    j.title === newJournalTitle.trim() && 
                    j.description === newJournalDescription.trim()
                );
                
                if (newJournal) {
                    dispatch('select', { id: newJournal.id });
                }
            }
        } catch (error) {
            errorMessage = 'Error creating journal: ' + error.message;
        }
    };
    
    // Handle journal selection
    const handleJournalSelect = (event) => {
        dispatch('select', event.detail);
    };
    
    // Toggle create form visibility
    const toggleCreateForm = () => {
        showCreateForm = !showCreateForm;
        if (!showCreateForm) {
            // Reset form when hiding
            newJournalTitle = '';
            newJournalDescription = '';
            errorMessage = '';
        }
    };
</script>

<div class="bg-white rounded-lg shadow-md p-4">
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-indigo-900">Journals</h2>
        <button
            on:click={toggleCreateForm}
            class="text-sm px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
            {showCreateForm ? 'Cancel' : 'New Journal'}
        </button>
    </div>
    
    {#if showCreateForm}
        <div class="mb-4 p-3 border border-indigo-100 rounded-md bg-indigo-50">
            {#if errorMessage}
                <div class="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm" role="alert">
                    <span class="block sm:inline">{errorMessage}</span>
                </div>
            {/if}
            
            <form on:submit|preventDefault={createJournal} class="space-y-3">
                <div>
                    <label for="journal-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                        id="journal-title"
                        type="text"
                        bind:value={newJournalTitle}
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Journal Title"
                        required
                    />
                </div>
                
                <div>
                    <label for="journal-description" class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                        id="journal-description"
                        bind:value={newJournalDescription}
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Short description"
                        rows="2"
                    ></textarea>
                </div>
                
                <button
                    type="submit"
                    class="w-full py-1 px-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    disabled={$notesStore.state === noteStates.SAVING}
                >
                    {$notesStore.state === noteStates.SAVING ? 'Creating...' : 'Create Journal'}
                </button>
            </form>
        </div>
    {/if}
    
    {#if $notesStore.journals.length === 0}
        <p class="text-gray-500 text-sm text-center my-4">No journals yet. Create one to organize your notes!</p>
    {:else}
        <div class="space-y-1 max-h-96 overflow-y-auto">
            {#each $notesStore.journals as journal (journal.id)}
                <JournalItem 
                    {journal} 
                    isActive={journal.id === activeJournalId}
                    on:select={handleJournalSelect}
                />
            {/each}
        </div>
    {/if}
</div> 