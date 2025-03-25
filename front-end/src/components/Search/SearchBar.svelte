<script>
    import { createEventDispatcher } from 'svelte';
    import { notesStore } from '../../stores/notes.store';
    
    const dispatch = createEventDispatcher();
    
    export let placeholder = "Search notes...";
    export let value = "";
    export let autoFocus = false;
    
    let inputElement;
    
    // Handle search input
    function handleInput(event) {
        value = event.target.value;
        dispatch('input', { value });
    }
    
    // Handle search submission
    function handleSubmit() {
        if (value.trim()) {
            dispatch('search', { query: value });
        }
    }
    
    // Handle enter key
    function handleKeyDown(event) {
        if (event.key === 'Enter' && value.trim()) {
            handleSubmit();
        }
    }
</script>

<div class="relative w-full">
    <div class="flex">
        <div class="relative flex-grow">
            <!-- Search Icon -->
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            
            <!-- Search Input -->
            <input 
                type="text" 
                bind:value 
                bind:this={inputElement}
                {placeholder} 
                class="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                on:input={handleInput}
                on:keydown={handleKeyDown}
                autofocus={autoFocus}
            />
            
            <!-- Clear Button -->
            {#if value}
                <button 
                    type="button" 
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    on:click={() => { value = ''; dispatch('clear'); }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                </button>
            {/if}
        </div>
        
        <!-- Search Button -->
        <button 
            type="button"
            class="ml-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            on:click={handleSubmit}
            disabled={!value.trim()}
        >
            Search
        </button>
    </div>
</div> 