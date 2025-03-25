import { writable } from 'svelte/store';

// AI assistant states
export const aiStates = {
    IDLE: 'idle',
    PROCESSING: 'processing',
    ERROR: 'error'
};

// Create the AI assistant store
function createAIStore() {
    const { subscribe, set, update } = writable({
        state: aiStates.IDLE,
        error: null,
        history: [],
        generatedContent: '',
        extractedKeywords: []
    });

    // Mock AI response for the prototype
    const mockAIResponse = async (prompt, type) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        let response;
        
        if (type === 'generate') {
            response = `# Generated Note: ${prompt}\n\nThis is an AI-generated note based on your prompt. Here's some expanded content:\n\n## Key Points\n- First important point about ${prompt}\n- Second important insight related to this topic\n- Third consideration for your notes\n\n## Additional Information\nHere's some more context that might be helpful for your notes on this subject.`;
            return response;
        } else if (type === 'summarize') {
            response = `## Summary\nThis is a summary of your note content. The main points are:\n1. First key point\n2. Second key point\n3. Third key point`;
            return response;
        } else if (type === 'extract') {
            return ['keyword1', 'keyword2', 'keyword3', prompt.split(' ')[0].toLowerCase()];
        }
        
        return '';
    };

    return {
        subscribe,
        
        // Generate note content based on prompt
        generateContent: async (prompt) => {
            update(store => ({ ...store, state: aiStates.PROCESSING, error: null }));
            
            try {
                const generatedContent = await mockAIResponse(prompt, 'generate');
                
                update(store => {
                    const historyItem = {
                        id: crypto.randomUUID(),
                        type: 'generate',
                        prompt,
                        response: generatedContent,
                        timestamp: new Date().toISOString()
                    };
                    
                    return {
                        ...store,
                        state: aiStates.IDLE,
                        generatedContent,
                        history: [...store.history, historyItem]
                    };
                });
                
                return generatedContent;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: aiStates.ERROR,
                    error: error.message
                }));
                
                return null;
            }
        },
        
        // Summarize note content
        summarizeContent: async (content) => {
            update(store => ({ ...store, state: aiStates.PROCESSING, error: null }));
            
            try {
                const summary = await mockAIResponse(content, 'summarize');
                
                update(store => {
                    const historyItem = {
                        id: crypto.randomUUID(),
                        type: 'summarize',
                        original: content,
                        response: summary,
                        timestamp: new Date().toISOString()
                    };
                    
                    return {
                        ...store,
                        state: aiStates.IDLE,
                        history: [...store.history, historyItem]
                    };
                });
                
                return summary;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: aiStates.ERROR,
                    error: error.message
                }));
                
                return null;
            }
        },
        
        // Extract keywords from content
        extractKeywords: async (content) => {
            update(store => ({ ...store, state: aiStates.PROCESSING, error: null }));
            
            try {
                const keywords = await mockAIResponse(content, 'extract');
                
                update(store => {
                    const historyItem = {
                        id: crypto.randomUUID(),
                        type: 'extract',
                        original: content,
                        response: keywords,
                        timestamp: new Date().toISOString()
                    };
                    
                    return {
                        ...store,
                        state: aiStates.IDLE,
                        extractedKeywords: keywords,
                        history: [...store.history, historyItem]
                    };
                });
                
                return keywords;
            } catch (error) {
                update(store => ({
                    ...store,
                    state: aiStates.ERROR,
                    error: error.message
                }));
                
                return [];
            }
        },
        
        // Clear generated content
        clearGeneratedContent: () => {
            update(store => ({
                ...store,
                generatedContent: '',
                extractedKeywords: []
            }));
        },
        
        // Clear error state
        clearError: () => {
            update(store => ({
                ...store,
                state: aiStates.IDLE,
                error: null
            }));
        }
    };
}

export const aiStore = createAIStore(); 