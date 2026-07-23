export declare const useSessionStore: import("pinia").StoreDefinition<"session", Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string, avatarGender: "female" | "male") => Promise<void>;
    logout: () => void;
}, "loading" | "error" | "authenticated">, Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string, avatarGender: "female" | "male") => Promise<void>;
    logout: () => void;
}, never>, Pick<{
    authenticated: import("vue").Ref<boolean, boolean>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email: string, playerName: string, avatarGender: "female" | "male") => Promise<void>;
    logout: () => void;
}, "logout" | "login" | "register">>;
