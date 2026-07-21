export declare const useSessionStore: import("pinia").StoreDefinition<"session", Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string) => Promise<void>;
    logout: () => void;
}, "authenticated" | "loading" | "error">, Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string) => Promise<void>;
    logout: () => void;
}, never>, Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string) => Promise<void>;
    logout: () => void;
}, "login" | "register" | "logout">>;
