<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { aiStore, aiStates } from '../../stores/ai.store';
    import SvelteMarkdown from 'svelte-markdown';
    
    let userMessage = '';
    let chatMessages = [];
    let chatContainer;
    let isGenerating = false;
    
    const dispatch = createEventDispatcher();
    
    // Functions for different AI capabilities
    const generateNote = async () => {
        if (!userMessage.trim()) return;
        
        addMessage('user', userMessage);
        isGenerating = true;
        
        try {
            const content = await aiStore.generateContent(userMessage);
            addMessage('assistant', content);
            
            // Dispatch event to create a new note with the generated content
            dispatch('createNote', { title: userMessage, content });
        } catch (error) {
            addMessage('assistant', `Error generating content: ${error.message}`);
        } finally {
            isGenerating = false;
            userMessage = '';
        }
    };
    
    const summarizeText = async () => {
        if (!userMessage.trim()) return;
        
        addMessage('user', `Please summarize the following content: ${userMessage}`);
        isGenerating = true;
        
        try {
            const summary = await aiStore.summarizeContent(userMessage);
            addMessage('assistant', summary);
            
            // Dispatch event with summarized content
            dispatch('useSummary', { summary });
        } catch (error) {
            addMessage('assistant', `Error generating summary: ${error.message}`);
        } finally {
            isGenerating = false;
            userMessage = '';
        }
    };
    
    const extractKeywords = async () => {
        if (!userMessage.trim()) return;
        
        addMessage('user', `Please extract keywords from this text: ${userMessage}`);
        isGenerating = true;
        
        try {
            const keywords = await aiStore.extractKeywords(userMessage);
            const keywordsText = keywords.join(', ');
            addMessage('assistant', `Here are the keywords I extracted:\n\n${keywordsText}`);
            
            // Dispatch event with extracted keywords
            dispatch('useKeywords', { keywords });
        } catch (error) {
            addMessage('assistant', `Error extracting keywords: ${error.message}`);
        } finally {
            isGenerating = false;
            userMessage = '';
        }
    };
    
    const askGeneral = async () => {
        if (!userMessage.trim()) return;
        
        addMessage('user', userMessage);
        isGenerating = true;
        
        try {
            // For general questions, we'll use the generateContent function
            // but won't create a note from it
            const response = await aiStore.generateContent(userMessage);
            addMessage('assistant', response);
        } catch (error) {
            addMessage('assistant', `Error: ${error.message}`);
        } finally {
            isGenerating = false;
            userMessage = '';
        }
    };
    
    // Helper to add a message to the chat
    function addMessage(role, content) {
        chatMessages = [...chatMessages, { 
            id: Date.now().toString(),
            role, 
            content,
            timestamp: new Date().toISOString()
        }];
        
        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);
    }
    
    // Handle message submission
    function handleSubmit() {
        if (isGenerating || !userMessage.trim()) return;
        askGeneral();
    }
    
    // Add welcome message on mount
    onMount(() => {
        addMessage('assistant', 'Hello! I am AGNIS, your AI note-taking assistant. How can I help you today? You can ask me to:\n\n1. Generate a note\n2. Summarize text\n3. Extract keywords\n4. Answer general questions');
    });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col h-full">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">AGNIS Assistant</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">Your AI note-taking companion</p>
    </div>
    
    <!-- Chat messages -->
    <div 
        class="flex-1 overflow-y-auto p-4 space-y-4" 
        bind:this={chatContainer}
    >
        {#each chatMessages as message (message.id)}
            <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                <div 
                    class="max-w-[80%] rounded-lg p-3 {message.role === 'user' 
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-gray-800 dark:text-gray-200' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}"
                >
                    {#if message.role === 'assistant'}
                        <div class="prose dark:prose-invert prose-sm">
                            <SvelteMarkdown source={message.content} />
                        </div>
                    {:else}
                        <p>{message.content}</p>
                    {/if}
                </div>
            </div>
        {/each}
        
        {#if isGenerating}
            <div class="flex justify-start">
                <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-w-[80%]">
                    <div class="flex space-x-2">
                        <div class="w-2 h-2 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
    
    <!-- Quick actions -->
    <div class="p-2 border-t border-b border-gray-200 dark:border-gray-700">
        <div class="flex space-x-2 overflow-x-auto pb-2">
            <button 
                class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm whitespace-nowrap"
                on:click={generateNote}
                disabled={isGenerating}
            >
                Generate Note
            </button>
            <button 
                class="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm whitespace-nowrap"
                on:click={summarizeText}
                disabled={isGenerating}
            >
                Summarize Text
            </button>
            <button 
                class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm whitespace-nowrap"
                on:click={extractKeywords}
                disabled={isGenerating}
            >
                Extract Keywords
            </button>
        </div>
    </div>
    
    <!-- Message input -->
    <form on:submit|preventDefault={handleSubmit} class="p-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex">
            <input
                type="text"
                bind:value={userMessage}
                placeholder="Type your message..."
                class="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l focus:outline-none focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                disabled={isGenerating}
            />
            <button
                type="submit"
                class="px-4 py-2 bg-indigo-600 text-white rounded-r hover:bg-indigo-700 focus:outline-none focus:bg-indigo-700 disabled:opacity-50"
                disabled={isGenerating || !userMessage.trim()}
            >
                Send
            </button>
        </div>
    </form>
</div> 