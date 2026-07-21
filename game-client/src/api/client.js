import axios, { AxiosError } from 'axios';
const TOKEN_KEY = 'world_access_token';
export const api = axios.create({
    baseURL: '/api/v1',
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
export function saveToken(token) {
    if (token)
        sessionStorage.setItem(TOKEN_KEY, token);
    else
        sessionStorage.removeItem(TOKEN_KEY);
}
export function hasToken() {
    return Boolean(sessionStorage.getItem(TOKEN_KEY));
}
export async function requestData(request) {
    const response = await request;
    return response.data.data;
}
export function errorMessage(error) {
    if (error instanceof AxiosError) {
        const message = error.response?.data?.message;
        if (message)
            return message;
        if (error.code === 'ECONNABORTED')
            return '请求超时，请检查网络后重试';
        if (!error.response)
            return '无法连接游戏服务器，请确认后端已经启动';
    }
    return '操作失败，请稍后重试';
}
