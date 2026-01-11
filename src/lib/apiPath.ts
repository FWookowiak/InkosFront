import axiosInstance from "./axios";

export async function smartGet<T = any>(path: string, options?: any): Promise<T> {
    try {
        const { data } = await axiosInstance.get<T>(path, options);
        return data;
    } catch (e: any) {
        const status = e?.response?.status;
        // jeśli 404/405/301/302 – spróbuj z prefiksem /swagger
        if (status === 404 || status === 405 || status === 301 || status === 302) {
            const prefixed = path.startsWith("/swagger/") ? path : `/swagger${path.startsWith("/") ? "" : "/"}${path}`;
            const { data } = await axiosInstance.get<T>(prefixed, options);
            return data;
        }
        throw e;
    }
}