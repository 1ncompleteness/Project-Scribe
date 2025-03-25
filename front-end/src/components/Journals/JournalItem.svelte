<script>
    import { createEventDispatcher } from 'svelte';
    import { notesStore } from '../../stores/notes.store';
    
    export let journal;
    export let isActive = false;
    
    const dispatch = createEventDispatcher();
    
    // Get note count
    $: noteCount = journal.noteIds.length;
    
    // Format the date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    
    // Handle select journal
    const handleSelect = () => {
        dispatch('select', { id: journal.id });
    };
    
    // Handle delete journal
    const handleDelete = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete journal "${journal.title}"? This won't delete the notes inside it.`)) {
            notesStore.deleteJournal(journal.id);
        }
    };
</script>

<div 
    class="p-3 rounded-md cursor-pointer mb-2 transition-colors {isActive ? 'bg-indigo-100' : 'hover:bg-gray-100'}"
    on:click={handleSelect}
>
    <div class="flex justify-between items-start mb-1">
        <h3 class="font-medium text-indigo-800 truncate">{journal.title}</h3>
        <button 
            on:click={handleDelete} 
            class="text-gray-400 hover:text-red-500 text-sm font-bold"
            title="Delete Journal"
        >
            &times;
        </button>
    </div>
    
    {#if journal.description}
        <p class="text-sm text-gray-600 mb-1 truncate">{journal.description}</p>
    {/if}
    
    <div class="flex justify-between text-xs text-gray-500">
        <span>{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
        <span>Updated {formatDate(journal.updatedAt)}</span>
    </div>
</div> 