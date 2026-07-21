import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, errorMessage, hasToken, requestData, saveToken } from '@/api/client';
export const useSessionStore = defineStore('session', () => {
    const authenticated = ref(hasToken());
    const loading = ref(false);
    const error = ref('');
    async function login(username, password) {
        loading.value = true;
        error.value = '';
        try {
            const result = await requestData(api.post('/auth/login', { username, password }));
            saveToken(result.access_token);
            authenticated.value = true;
        }
        catch (cause) {
            error.value = errorMessage(cause);
            throw cause;
        }
        finally {
            loading.value = false;
        }
    }
    async function register(username, password, email, playerName) {
        loading.value = true;
        error.value = '';
        try {
            const result = await requestData(api.post('/auth/register', {
                username,
                password,
                email: email || null,
                player_name: playerName || null,
            }));
            saveToken(result.access_token);
            authenticated.value = true;
        }
        catch (cause) {
            error.value = errorMessage(cause);
            throw cause;
        }
        finally {
            loading.value = false;
        }
    }
    function logout() {
        saveToken(null);
        sessionStorage.removeItem('world_battle_id');
        authenticated.value = false;
        error.value = '';
    }
    return { authenticated, loading, error, login, register, logout };
});
