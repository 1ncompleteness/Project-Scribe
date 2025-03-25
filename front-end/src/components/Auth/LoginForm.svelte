<script>
    import { authStore, authStates } from '../../stores/auth.store';
    
    let username = '';
    let password = '';
    let errorMessage = '';
    
    const handleLogin = async () => {
        errorMessage = '';
        
        if (!username || !password) {
            errorMessage = 'Username and password are required';
            return;
        }
        
        const success = await authStore.login(username, password);
        
        if (!success) {
            errorMessage = $authStore.error || 'Login failed';
        }
    };
</script>

<div class="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
    <h2 class="text-2xl font-semibold text-center mb-6 text-indigo-800">Login to Scribe Project</h2>
    
    {#if errorMessage}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <span class="block sm:inline">{errorMessage}</span>
        </div>
    {/if}
    
    <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
                id="username"
                type="text"
                bind:value={username}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your username"
                autocomplete="username"
                required
            />
        </div>
        
        <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
                id="password"
                type="password"
                bind:value={password}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
            />
        </div>
        
        <button
            type="submit"
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={$authStore.state === authStates.LOGGING_IN}
        >
            {$authStore.state === authStates.LOGGING_IN ? 'Logging in...' : 'Login'}
        </button>
    </form>
</div> 