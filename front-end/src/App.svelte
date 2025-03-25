<script>
    import { tick } from "svelte";
    import SvelteMarkdown from "svelte-markdown";
    import botImage from "./assets/images/bot.jpeg";
    import meImage from "./assets/images/me.jpeg";
    import MdLink from "./lib/MdLink.svelte";
    import External from "./lib/External.svelte";
    import { chatStates, chatStore } from "./lib/chat.store.js";
    import Modal from "./lib/Modal.svelte";
    import { generationStore } from "./lib/generation.store";
    import { onMount } from 'svelte';
    import { authStore, authStates } from './stores/auth.store';
    import Auth from './components/Auth/Auth.svelte';
    import Dashboard from './components/Dashboard/Dashboard.svelte';
    import neo4jService from './services/neo4j.service';

    let ragMode = false;
    let question = "How can I calculate age from date of birth in Cypher?";
    let shouldAutoScroll = true;
    let input;
    let senderImages = { bot: botImage, me: meImage };
    let generationModalOpen = false;
    let connectionError = null;

    function send() {
        chatStore.send(question, ragMode);
        question = "";
    }

    function scrollToBottom(node, _) {
        const scroll = () => node.scrollTo({ top: node.scrollHeight });
        scroll();
        return { update: () => shouldAutoScroll && scroll() };
    }

    function scrolling(e) {
        shouldAutoScroll = e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 55;
    }

    function generateTicket(text) {
        generationStore.generate(text);
        generationModalOpen = true;
    }

    $: $chatStore.state === chatStates.IDLE && input && focus(input);
    async function focus(node) {
        await tick();
        node.focus();
    }
    // send();

    // Check authentication and database connection status on mount
    onMount(async () => {
        // First try to connect to Neo4j
        try {
            const connected = await neo4jService.connect();
            if (!connected) {
                connectionError = "Failed to connect to Neo4j database. Please make sure the database is running.";
                return;
            }
            
            // Then check authentication
            await authStore.checkAuth();
        } catch (error) {
            connectionError = `Database connection error: ${error.message}`;
        }
    });
</script>

<main class="h-full">
    {#if connectionError}
        <div class="h-full flex items-center justify-center bg-red-50">
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <h2 class="text-2xl font-bold text-red-600 mb-4">Database Connection Error</h2>
                <p class="text-gray-700 mb-6">{connectionError}</p>
                <button 
                    class="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
                    on:click={() => window.location.reload()}
                >
                    Retry Connection
                </button>
            </div>
        </div>
    {:else if $authStore.state === authStates.LOGGED_IN}
        <Dashboard />
    {:else}
        <Auth />
    {/if}
</main>

<style>
    :global(pre) {
        @apply bg-gray-100 rounded-lg p-4 border border-indigo-200;
    }
    :global(code) {
        @apply text-indigo-500;
    }

    :global(html, body) {
        height: 100%;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
            Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }

    :global(#app) {
        height: 100%;
    }

    main {
        height: 100%;
    }
</style>
