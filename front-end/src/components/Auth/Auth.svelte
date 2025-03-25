<script>
    import { onMount } from 'svelte';
    import { authStore, authStates } from '../../stores/auth.store';
    import LoginForm from './LoginForm.svelte';
    import RegisterForm from './RegisterForm.svelte';
    
    let showLogin = true;
    
    onMount(() => {
        authStore.checkAuth();
    });
    
    const toggleForm = () => {
        showLogin = !showLogin;
    };
</script>

<div class="min-h-screen flex items-center justify-center bg-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="w-full max-w-md space-y-8">
        <div>
            <h1 class="text-center text-3xl font-bold tracking-tight text-indigo-900">
                The Scribe Project
            </h1>
            <p class="mt-2 text-center text-sm text-gray-600">
                Your personal AI-assisted note-taking companion
            </p>
        </div>
        
        {#if showLogin}
            <LoginForm />
            <div class="mt-4 text-center">
                <p class="text-sm text-gray-600">
                    Don't have an account?
                    <button
                        on:click={toggleForm}
                        class="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                        Register now
                    </button>
                </p>
            </div>
        {:else}
            <RegisterForm />
            <div class="mt-4 text-center">
                <p class="text-sm text-gray-600">
                    Already have an account?
                    <button
                        on:click={toggleForm}
                        class="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                        Log in
                    </button>
                </p>
            </div>
        {/if}
    </div>
</div> 