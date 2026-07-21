import type { ApiEnvelope } from './types';
export declare const api: import("axios").AxiosInstance;
export declare function saveToken(token: string | null): void;
export declare function hasToken(): boolean;
export declare function requestData<T>(request: Promise<{
    data: ApiEnvelope<T>;
}>): Promise<T>;
export declare function errorMessage(error: unknown): string;
