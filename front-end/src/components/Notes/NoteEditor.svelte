<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { notesStore, noteStates } from '../../stores/notes.store';
    import { aiStore, aiStates } from '../../stores/ai.store';
    import SvelteMarkdown from 'svelte-markdown';
    
    export let noteId = null;
    
    let title = '';
    let content = '';
    let tags = [];
    let tagInput = '';
    let isEditing = true;
    let isSaving = false;
    let errorMessage = '';
    let availableTags = [];
    let spellCheck = true;
    let editorContainer;
    let mediaFiles = [];
    let fileInput;
    
    const dispatch = createEventDispatcher();
    
    // Initialize the editor with the current note if noteId is provided
    $: if (noteId && $notesStore.notes) {
        const note = $notesStore.notes.find(n => n.id === noteId);
        if (note) {
            title = note.title;
            content = note.content;
            tags = [...note.tags];
            
            // Extract media files from content if any
            extractMediaFromContent();
        }
    }
    
    // Fetch available tags from the store
    $: availableTags = $notesStore.tags;
    
    // Monitor saving state
    $: isSaving = $notesStore.state === noteStates.SAVING;
    
    // Extract media files from content
    function extractMediaFromContent() {
        // Regular expression to find markdown image and audio tags
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        const audioRegex = /\[audio:(.*?)\]/g;
        
        // Find all image URLs
        let match;
        mediaFiles = [];
        
        while ((match = imageRegex.exec(content)) !== null) {
            mediaFiles.push({
                type: 'image',
                url: match[1],
                placeholder: match[0]
            });
        }
        
        // Find all audio URLs
        while ((match = audioRegex.exec(content)) !== null) {
            mediaFiles.push({
                type: 'audio',
                url: match[1],
                placeholder: match[0]
            });
        }
    }
    
    // Save the note
    const saveNote = async () => {
        if (!title.trim()) {
            errorMessage = 'Please enter a title for your note';
            return;
        }
        
        try {
            if (noteId) {
                // Update existing note
                await notesStore.updateNote(noteId, {
                    title: title.trim(),
                    content,
                    tags
                });
            } else {
                // Create new note
                const result = await notesStore.createNote(title.trim(), content, tags);
                if (result) {
                    dispatch('created', { id: $notesStore.currentNote.id });
                }
            }
            
            errorMessage = '';
        } catch (error) {
            errorMessage = 'Error saving note: ' + error.message;
        }
    };
    
    // Toggle between edit and preview modes
    const toggleMode = () => {
        isEditing = !isEditing;
    };
    
    // Add a tag to the note
    const addTag = () => {
        const trimmedTag = tagInput.trim().toLowerCase();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            tags = [...tags, trimmedTag];
            
            // Add to global tags if not already there
            if (!availableTags.includes(trimmedTag)) {
                notesStore.addTag(trimmedTag);
            }
            
            tagInput = '';
        }
    };
    
    // Remove a tag from the note
    const removeTag = (tag) => {
        tags = tags.filter(t => t !== tag);
    };
    
    // Handle keyboard shortcuts
    const handleKeydown = (event) => {
        // Ctrl+S or Cmd+S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            saveNote();
        }
        
        // Ctrl+E or Cmd+E to toggle edit/preview
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            toggleMode();
        }
    };
    
    // Generate content with AI
    const generateWithAI = async () => {
        if (!title.trim()) {
            errorMessage = 'Please enter a title to generate content';
            return;
        }
        
        try {
            const generated = await aiStore.generateContent(title);
            if (generated) {
                content = generated;
                
                // Extract keywords and add as tags
                const keywords = await aiStore.extractKeywords(title + " " + content);
                if (keywords && keywords.length) {
                    for (const keyword of keywords) {
                        if (!tags.includes(keyword)) {
                            tags = [...tags, keyword];
                            
                            // Add to global tags if not already there
                            if (!availableTags.includes(keyword)) {
                                notesStore.addTag(keyword);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            errorMessage = 'Error generating content: ' + error.message;
        }
    };
    
    // Summarize content with AI
    const summarizeWithAI = async () => {
        if (!content.trim()) {
            errorMessage = 'Please enter some content to summarize';
            return;
        }
        
        try {
            const summary = await aiStore.summarizeContent(content);
            if (summary) {
                content += '\n\n' + summary;
            }
        } catch (error) {
            errorMessage = 'Error summarizing content: ' + error.message;
        }
    };
    
    // Handle file uploads
    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                
                // Determine if it's an image or audio file
                if (file.type.startsWith('image/')) {
                    // Insert image markdown at cursor position or at the end
                    insertMediaAtCursor(`![${file.name}](${dataUrl})`, 'image', dataUrl, file.name);
                } else if (file.type.startsWith('audio/')) {
                    // Insert custom audio markdown
                    insertMediaAtCursor(`[audio:${dataUrl}]`, 'audio', dataUrl, file.name);
                }
            };
            
            reader.readAsDataURL(file);
        }
        
        // Reset file input
        if (fileInput) {
            fileInput.value = '';
        }
    };
    
    // Insert media at cursor position or at the end of content
    const insertMediaAtCursor = (markdown, type, url, filename) => {
        const textarea = document.querySelector('textarea');
        
        if (textarea && textarea.selectionStart !== undefined) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            
            content = content.substring(0, startPos) + 
                     '\n\n' + markdown + '\n\n' + 
                     content.substring(endPos);
            
            // Add to media files array
            mediaFiles = [...mediaFiles, {
                type,
                url,
                placeholder: markdown,
                name: filename
            }];
        } else {
            // If no selection or textarea not found, append to the end
            content += '\n\n' + markdown + '\n\n';
            
            // Add to media files array
            mediaFiles = [...mediaFiles, {
                type,
                url,
                placeholder: markdown,
                name: filename
            }];
        }
    };
    
    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
    <!-- Error message -->
    {#if errorMessage}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <span class="block sm:inline">{errorMessage}</span>
        </div>
    {/if}
    
    <div class="mb-4">
        <input
            type="text"
            bind:value={title}
            placeholder="Note Title"
            class="w-full text-xl font-semibold p-2 border-b border-indigo-200 dark:border-indigo-700 focus:outline-none focus:border-indigo-500 bg-transparent dark:text-white"
        />
    </div>
    
    <div class="flex justify-between mb-4 flex-wrap gap-2">
        <div class="flex space-x-2">
            <button
                on:click={toggleMode}
                class="px-3 py-1 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-700 text-sm"
            >
                {isEditing ? 'Preview' : 'Edit'}
            </button>
            
            <button
                on:click={saveNote}
                disabled={isSaving}
                class="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm disabled:opacity-50"
            >
                {isSaving ? 'Saving...' : 'Save'}
            </button>
            
            <label
                class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm cursor-pointer"
                for="media-upload"
            >
                Add Media
            </label>
            <input
                id="media-upload"
                type="file"
                accept="image/*,audio/*"
                on:change={handleFileUpload}
                class="hidden"
                multiple
                bind:this={fileInput}
            />
        </div>
        
        <div class="flex space-x-2">
            <button
                on:click={generateWithAI}
                disabled={$aiStore.state === aiStates.PROCESSING}
                class="px-3 py-1 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-sm disabled:opacity-50"
            >
                {$aiStore.state === aiStates.PROCESSING ? 'Processing...' : 'Generate with AI'}
            </button>
            
            <button
                on:click={summarizeWithAI}
                disabled={$aiStore.state === aiStates.PROCESSING || !content}
                class="px-3 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 text-sm disabled:opacity-50"
            >
                {$aiStore.state === aiStates.PROCESSING ? 'Processing...' : 'Summarize'}
            </button>
        </div>
    </div>
    
    <div class="flex-grow overflow-auto" bind:this={editorContainer}>
        {#if isEditing}
            <div class="h-full">
                <textarea
                    bind:value={content}
                    placeholder="Write your note here... (Markdown supported)"
                    class="w-full h-full p-2 border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none focus:border-indigo-500 bg-transparent dark:text-white"
                    spellcheck={spellCheck}
                ></textarea>
            </div>
        {:else}
            <div class="w-full h-full p-2 border border-gray-200 dark:border-gray-700 rounded overflow-auto markdown-preview">
                <SvelteMarkdown source={content} />
                
                <!-- Render audio elements that aren't natively supported by markdown -->
                {#each mediaFiles.filter(m => m.type === 'audio') as media (media.url)}
                    <div class="my-4">
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Audio:</p>
                        <audio controls src={media.url} class="w-full">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    
    <div class="mt-4">
        <div class="flex items-center mb-3">
            <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <input 
                    type="checkbox" 
                    bind:checked={spellCheck} 
                    class="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                >
                Spell Check
            </label>
        </div>
    
        <div class="flex flex-wrap gap-2 mb-2">
            {#each tags as tag}
                <span class="flex items-center bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded-full text-sm">
                    {tag}
                    <button
                        on:click={() => removeTag(tag)}
                        class="ml-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                    >
                        &times;
                    </button>
                </span>
            {/each}
        </div>
        
        <div class="flex">
            <input
                type="text"
                bind:value={tagInput}
                placeholder="Add a tag"
                class="flex-grow p-2 border border-gray-200 dark:border-gray-700 rounded-l focus:outline-none focus:border-indigo-500 bg-transparent dark:text-white"
                on:keydown={(e) => e.key === 'Enter' && addTag()}
                list="available-tags"
            />
            <datalist id="available-tags">
                {#each availableTags as tag}
                    <option value={tag} />
                {/each}
            </datalist>
            <button
                on:click={addTag}
                class="px-3 py-2 rounded-r bg-indigo-600 text-white hover:bg-indigo-700"
            >
                Add
            </button>
        </div>
    </div>
</div>

<style>
    .markdown-preview :global(h1) {
        font-size: 1.5rem;
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    
    .markdown-preview :global(h2) {
        font-size: 1.25rem;
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    
    .markdown-preview :global(h3) {
        font-size: 1.125rem;
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    
    .markdown-preview :global(p) {
        margin-bottom: 0.75rem;
    }
    
    .markdown-preview :global(ul), .markdown-preview :global(ol) {
        margin-left: 1.5rem;
        margin-bottom: 1rem;
    }
    
    .markdown-preview :global(li) {
        margin-bottom: 0.25rem;
    }
    
    .markdown-preview :global(blockquote) {
        border-left: 4px solid #e0e0e0;
        padding-left: 1rem;
        margin-left: 0;
        color: #6b7280;
    }
    
    .markdown-preview :global(pre) {
        background-color: #f3f4f6;
        padding: 0.75rem;
        border-radius: 0.25rem;
        overflow-x: auto;
        margin-bottom: 1rem;
    }
    
    .markdown-preview :global(code) {
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-family: monospace;
    }
    
    .markdown-preview :global(a) {
        color: #4f46e5;
        text-decoration: underline;
    }
    
    .markdown-preview :global(img) {
        max-width: 100%;
        height: auto;
        margin: 1rem 0;
        border-radius: 0.25rem;
    }
    
    /* Dark mode styles */
    :global(.dark) .markdown-preview :global(pre),
    :global(.dark) .markdown-preview :global(code) {
        background-color: #374151;
        color: #f3f4f6;
    }
    
    :global(.dark) .markdown-preview :global(blockquote) {
        border-left-color: #4b5563;
        color: #9ca3af;
    }
    
    :global(.dark) .markdown-preview :global(a) {
        color: #818cf8;
    }
</style> 