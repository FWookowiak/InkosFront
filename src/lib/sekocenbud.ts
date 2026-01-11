// src/lib/sekocenbud.ts
import axiosInstance from "./axios";

export type DbKey = "220" | "224";
export type SearchMode = "bcj" | "wki" | "combined";

export interface SekocenbudItem {
    symbol?: string;   // np. kod
    name?: string;     // opis
    unit?: string;     // jm
    price?: number;    // cena
    catalog?: string;  // BCJ
    group?: string;    // BCJ
    gr?: string;       // WKI
    pgr?: string;      // WKI
    [k: string]: any;
}

// ---- pomocniczo: spróbuj kolejnych ścieżek, zwróć pierwszą działającą ----
async function fetchFirst<T>(paths: string[], params: Record<string, any>) {
    let lastErr: any = null;
    for (const path of paths) {
        try {
            const { data } = await axiosInstance.get<T>(path, { params });
            return data;
        } catch (e) {
            lastErr = e;
            // próbujemy następny wariant
        }
    }
    throw lastErr;
}

// ---- SEARCH: znamy 3 endpointy z maila + warianty (root, sekocenbud/search, swagger) ----
export async function searchWKI(params: { db_key: string; search?: string; gr?: string; pgr?: string }) {
    const paths = [
        "/wki",
        "/wki/",
        "/sekocenbud/search/wki/",
        "/sekocenbud/search/wki",
        "/swagger/wki",
        "/swagger/wki/",
        "/swagger/sekocenbud/search/wki/",
    ];
    return fetchFirst<SekocenbudItem[]>(paths, params);
}

export async function searchBCJ(params: { db_key: string; search?: string; catalog?: string; group?: string }) {
    const paths = [
        "/BCJ",           // zauważyłeś w Network, że jest wielkimi literami
        "/BCJ/",
        "/bcj",
        "/bcj/",
        "/sekocenbud/search/bcj/",
        "/sekocenbud/search/bcj",
        "/swagger/BCJ",
        "/swagger/BCJ/",
        "/swagger/sekocenbud/search/bcj/",
    ];
    return fetchFirst<SekocenbudItem[]>(paths, params);
}

export async function searchCombined(params: { db_key: string; search?: string }) {
    const paths = [
        "/combined",
        "/combined/",
        "/sekocenbud/search/combined/",
        "/sekocenbud/search/combined",
        "/swagger/combined",
        "/swagger/combined/",
        "/swagger/sekocenbud/search/combined/",
    ];
    return fetchFirst<any>(paths, params);
}

// ---- PARAMS „na skróty” (dopóki nie mamy oficjalnych endpoints) ----
// BCJ: listy katalogów i grup wyciągamy z wyników search
export async function getBCJCatalogs(db_key: string) {
    const rows = await searchBCJ({ db_key, search: "" });
    const set = new Set<string>();
    rows.forEach(r => r.catalog && set.add(String(r.catalog)));
    return Array.from(set).sort();
}
export async function getBCJGroups(db_key: string, catalog?: string) {
    const rows = await searchBCJ({ db_key, search: "", catalog });
    const set = new Set<string>();
    rows.forEach(r => r.group && set.add(String(r.group)));
    return Array.from(set).sort();
}

// WKI: listy grup i podgrup
export async function getWKIGroups(db_key: string) {
    const rows = await searchWKI({ db_key, search: "" });
    const set = new Set<string>();
    rows.forEach(r => r.gr && set.add(String(r.gr)));
    return Array.from(set).sort();
}
export async function getWKISubgroups(db_key: string, gr?: string) {
    const rows = await searchWKI({ db_key, search: "", gr });
    const set = new Set<string>();
    rows.forEach(r => r.pgr && set.add(String(r.pgr)));
    return Array.from(set).sort();
}
