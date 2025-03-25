<script>
    import { createEventDispatcher } from 'svelte';
    import { notesStore } from '../../stores/notes.store';
    
    export let note;
    
    const dispatch = createEventDispatcher();
    
    // Format the date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    
    // Create a preview of the content, removing markdown syntax
    const createPreview = (content, length = 150) => {
        // Remove markdown syntax
        const plainText = content
            .replace(/#+\s+/g, '') // Remove heading markers
            .replace(/\*\*?(.*?)\*\*?/g, '$1') // Remove bold/italic markers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Replace links with just text
            .replace(/`{1,3}.*?`{1,3}/g, '') // Remove code blocks
            .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
            .replace(/^\s*\d+\.\s+/gm, ''); // Remove numbered list markers
        
        // Trim to desired length and add ellipsis if needed
        return plainText.length > length
            ? plainText.substring(0, length) + '...'
            : plainText;
    };
    
    // Handle selecting the note
    const handleSelect = () => {
        notesStore.setCurrentNote(note.id);
        dispatch('select', { id: note.id });
    };
</script>

<div 
    class="bg-white p-4 rounded-lg shadow-sm border border-indigo-100 hover:shadow-md transition-shadow cursor-pointer"
    on:click={handleSelect}
>
    <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-semibold text-indigo-900 truncate">{note.title}</h3>
        <span class="text-xs text-gray-500">{formatDate(note.updatedAt)}</span>
    </div>
    
    <p class="text-gray-600 text-sm mb-3">{createPreview(note.content)}</p>
    
    {#if note.tags && note.tags.length > 0}
        <div class="flex flex-wrap gap-1 mt-2">
            {#each note.tags as tag}
                <span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                    {tag}
                </span>
            {/each}
        </div>
    {/if}
</div> 