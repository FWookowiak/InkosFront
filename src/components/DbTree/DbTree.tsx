// src/components/DbTree.tsx
import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";

type Tab = "BCJ" | "WKI";

type BcjGroup = {
    uuid: string;
    catalog: string;
    symbol: string;
    opis: string;
};
type BcjCatalog = string;

type WkiRow = Record<string, any>; // dane z API, kolumny: SYMBOL, OPIS, JM/JM_NAZWA, CENA_SR, GR_NUM, PGR_NUM, ...

const DB_KEY = "224";                      // Na razie używamy tylko 2024
const WKI_GR = [1, 2, 3, 4, 5, 6, 7];      // Struktura WKI znana z kodu backendu
const WKI_PGR = [100,200,300,400,500,600,700,800,900];
const DEFAULT_SEARCH = "a";                // krótka fraza, żeby zwrócić "dużo" pozycji
const PAGE_SIZE = 200;                     // ile pozycji renderujemy na start

export default function DbTree() {
    const [tab, setTab] = useState<Tab>("BCJ");

    // --- BCJ state ---
    const [bcjCatalogs, setBcjCatalogs] = useState<BcjCatalog[]>([]);
    const [bcjExpandedCatalogs, setBcjExpandedCatalogs] = useState<Record<string, boolean>>({});
    const [bcjGroupsByCatalog, setBcjGroupsByCatalog] = useState<Record<string, BcjGroup[]>>({});
    const [bcjLoading, setBcjLoading] = useState(false);
    const [bcjError, setBcjError] = useState<string | null>(null);

    // --- WKI state ---
    const [wkiExpandedGr, setWkiExpandedGr] = useState<Record<number, boolean>>({});
    const [wkiExpandedPgr, setWkiExpandedPgr] = useState<Record<string, boolean>>({});
    const [wkiItemsByKey, setWkiItemsByKey] = useState<Record<string, WkiRow[] | undefined>>({});
    const [wkiLoadingByKey, setWkiLoadingByKey] = useState<Record<string, boolean>>({});
    const [wkiErrorByKey, setWkiErrorByKey] = useState<Record<string, string | undefined>>({});
    const [wkiLimitByKey, setWkiLimitByKey] = useState<Record<string, number>>({});

    // ===== BCJ =====
    useEffect(() => {
        if (tab !== "BCJ") return;
        let mounted = true;

        (async () => {
            setBcjError(null);
            setBcjLoading(true);
            try {
                const res = await axiosInstance.get(`/api/sekocenbud/params/bcj/catalogs`, {
                    params: { db_key: DB_KEY },
                });
                const catalogs: string[] = res.data?.catalogs ?? [];
                if (mounted) setBcjCatalogs(catalogs);
            } catch (e: any) {
                if (mounted) setBcjError(e?.message ?? "Błąd ładowania katalogów BCJ");
            } finally {
                if (mounted) setBcjLoading(false);
            }
        })();

        return () => { mounted = false; };
    }, [tab]);

    async function toggleBcjCatalog(catalog: string) {
        const next = !bcjExpandedCatalogs[catalog];
        setBcjExpandedCatalogs(prev => ({ ...prev, [catalog]: next }));

        if (next && !bcjGroupsByCatalog[catalog]) {
            try {
                const res = await axiosInstance.get(`/api/sekocenbud/params/bcj/groups`, {
                    params: { db_key: DB_KEY, catalog },
                });
                const groups: BcjGroup[] = res.data?.groups ?? [];
                setBcjGroupsByCatalog(prev => ({ ...prev, [catalog]: groups }));
            } catch (e: any) {
                setBcjError(e?.message ?? `Błąd ładowania grup dla katalogu ${catalog}`);
            }
        }
    }

    // ===== WKI =====
    function keyFor(gr: number, pgr: number) {
        return `${gr}-${pgr}`;
    }

    async function fetchWkiItems(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        setWkiLoadingByKey(prev => ({ ...prev, [key]: true }));
        setWkiErrorByKey(prev => ({ ...prev, [key]: undefined }));

        try {
            const res = await axiosInstance.get(`/api/sekocenbud/search/wki`, {
                params: {
                    db_key: DB_KEY,
                    gr,
                    pgr,
                    search: DEFAULT_SEARCH, // wymagany przez backend; wybieramy uniwersalny
                },
            });
            const rows: WkiRow[] = Array.isArray(res.data) ? res.data : [];
            setWkiItemsByKey(prev => ({ ...prev, [key]: rows }));
            setWkiLimitByKey(prev => ({ ...prev, [key]: PAGE_SIZE }));
        } catch (e: any) {
            setWkiErrorByKey(prev => ({ ...prev, [key]: e?.message ?? "Błąd pobierania danych WKI" }));
            setWkiItemsByKey(prev => ({ ...prev, [key]: [] }));
        } finally {
            setWkiLoadingByKey(prev => ({ ...prev, [key]: false }));
        }
    }

    function toggleWkiPgr(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        const next = !wkiExpandedPgr[key];
        setWkiExpandedPgr(prev => ({ ...prev, [key]: next }));
        if (next && wkiItemsByKey[key] === undefined) {
            // pierwszy raz rozwijamy -> pobierz realne dane
            fetchWkiItems(gr, pgr);
        }
    }

    function showMore(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        setWkiLimitByKey(prev => ({ ...prev, [key]: (prev[key] ?? PAGE_SIZE) + PAGE_SIZE }));
    }

    // ===== Render helpers =====
    function renderWkiItem(row: WkiRow, idx: number) {
        const symbol = row.SYMBOL ?? row.symbol ?? "";
        const opis = row.OPIS ?? row.opis ?? "";
        return (
            <li key={idx} className="px-2 py-1 rounded hover:bg-gray-50">
                <span className="font-mono mr-2">{symbol}</span>
                <span>{opis}</span>
            </li>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Zakładki */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setTab("BCJ")}
                    className={`px-3 py-1 rounded ${tab === "BCJ" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                >
                    BCJ (2024)
                </button>
                <button
                    onClick={() => setTab("WKI")}
                    className={`px-3 py-1 rounded ${tab === "WKI" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                >
                    WKI (2024)
                </button>
            </div>

            {/* Treść */}
            <div className="text-sm">
                {tab === "BCJ" ? (
                    <div>
                        {bcjLoading && <div>Ładowanie katalogów…</div>}
                        {bcjError && <div className="text-red-600">Błąd: {bcjError}</div>}
                        {!bcjLoading && !bcjError && (
                            <ul className="space-y-1">
                                {bcjCatalogs.map((cat) => {
                                    const expanded = !!bcjExpandedCatalogs[cat];
                                    const groups = bcjGroupsByCatalog[cat] ?? null;
                                    return (
                                        <li key={cat}>
                                            <button
                                                className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 border border-gray-200"
                                                onClick={() => toggleBcjCatalog(cat)}
                                            >
                                                <span className="mr-2">{expanded ? "▾" : "▸"}</span>
                                                <strong>{cat}</strong>
                                            </button>

                                            {expanded && (
                                                <div className="ml-4 mt-1">
                                                    {!groups && <div>Ładowanie grup…</div>}
                                                    {groups && groups.length === 0 && <div className="text-gray-500">Brak grup</div>}
                                                    {groups && groups.length > 0 && (
                                                        <ul className="space-y-0.5">
                                                            {groups.map((g) => (
                                                                <li key={g.uuid}>
                                                                    <div className="px-2 py-1 rounded hover:bg-gray-50">
                                                                        <span className="font-mono mr-2">{g.symbol}</span>
                                                                        <span>{g.opis}</span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div>
                        <ul className="space-y-1">
                            {WKI_GR.map((gr) => {
                                const expanded = !!wkiExpandedGr[gr];
                                return (
                                    <li key={gr}>
                                        <button
                                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 border border-gray-200"
                                            onClick={() => setWkiExpandedGr(prev => ({ ...prev, [gr]: !expanded }))}
                                        >
                                            <span className="mr-2">{expanded ? "▾" : "▸"}</span>
                                            <strong>GR {gr}</strong>
                                        </button>

                                        {expanded && (
                                            <div className="ml-4 mt-1">
                                                <ul className="space-y-0.5">
                                                    {WKI_PGR.map((pgr) => {
                                                        const key = `${gr}-${pgr}`;
                                                        const pgrExpanded = !!wkiExpandedPgr[key];
                                                        const items = wkiItemsByKey[key];
                                                        const loading = !!wkiLoadingByKey[key];
                                                        const error = wkiErrorByKey[key];
                                                        const limit = wkiLimitByKey[key] ?? PAGE_SIZE;

                                                        return (
                                                            <li key={key}>
                                                                <button
                                                                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 border border-gray-200"
                                                                    onClick={() => toggleWkiPgr(gr, pgr)}
                                                                >
                                                                    <span className="mr-2">{pgrExpanded ? "▾" : "▸"}</span>
                                                                    <span className="font-mono mr-2">PGR {pgr}</span>
                                                                    <span>Podgrupa</span>
                                                                </button>

                                                                {pgrExpanded && (
                                                                    <div className="ml-4 mt-1">
                                                                        {loading && <div>Ładowanie pozycji…</div>}
                                                                        {error && <div className="text-red-600">Błąd: {error}</div>}
                                                                        {items && items.length === 0 && !loading && !error && (
                                                                            <div className="text-gray-500">Brak pozycji</div>
                                                                        )}
                                                                        {items && items.length > 0 && (
                                                                            <>
                                                                                <ul className="space-y-0.5">
                                                                                    {items.slice(0, limit).map((row, idx) => renderWkiItem(row, idx))}
                                                                                </ul>
                                                                                {items.length > limit && (
                                                                                    <button
                                                                                        className="mt-2 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                                                                                        onClick={() => showMore(gr, pgr)}
                                                                                    >
                                                                                        Pokaż więcej ({limit} / {items.length})
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
