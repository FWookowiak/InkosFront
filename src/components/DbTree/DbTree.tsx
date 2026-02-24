// src/components/DbTree/DbTree.tsx
import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axios";

type Tab = "BCJ" | "WKI";

type BcjGroup = {
    uuid: string;
    catalog: string;
    symbol: string;
    opis: string;
};
type BcjCatalog = string;

type WkiRow = Record<string, any>;

type Props = {
    dbKey?: string; // np. data.sekocenbud_catalog
    onPickRow?: (row: any, source: "BCJ" | "WKI") => void;
};

const WKI_GR = [1, 2, 3, 4, 5, 6, 7];
const WKI_PGR = [100, 200, 300, 400, 500, 600, 700, 800, 900];

const DEFAULT_SEARCH = "a";
const PAGE_SIZE = 200;

export default function DbTree({ dbKey = "224", onPickRow }: Props) {
    const [tab, setTab] = useState<Tab>("BCJ");

    // --- BCJ state ---
    const [bcjCatalogs, setBcjCatalogs] = useState<BcjCatalog[]>([]);
    const [bcjExpandedCatalogs, setBcjExpandedCatalogs] = useState<Record<string, boolean>>({});
    const [bcjGroupsByCatalog, setBcjGroupsByCatalog] = useState<Record<string, BcjGroup[]>>({});
    const [bcjLoading, setBcjLoading] = useState(false);
    const [bcjError, setBcjError] = useState<string | null>(null);

    // BCJ items under a group (leaf rows)
    const [bcjExpandedGroups, setBcjExpandedGroups] = useState<Record<string, boolean>>({});
    const [bcjItemsByGroup, setBcjItemsByGroup] = useState<Record<string, any[] | undefined>>({});
    const [bcjLoadingByGroup, setBcjLoadingByGroup] = useState<Record<string, boolean>>({});
    const [bcjErrorByGroup, setBcjErrorByGroup] = useState<Record<string, string | undefined>>({});
    const [bcjLimitByGroup, setBcjLimitByGroup] = useState<Record<string, number>>({});

    // --- WKI state ---
    const [wkiExpandedGr, setWkiExpandedGr] = useState<Record<number, boolean>>({});
    const [wkiExpandedPgr, setWkiExpandedPgr] = useState<Record<string, boolean>>({});
    const [wkiItemsByKey, setWkiItemsByKey] = useState<Record<string, WkiRow[] | undefined>>({});
    const [wkiLoadingByKey, setWkiLoadingByKey] = useState<Record<string, boolean>>({});
    const [wkiErrorByKey, setWkiErrorByKey] = useState<Record<string, string | undefined>>({});
    const [wkiLimitByKey, setWkiLimitByKey] = useState<Record<string, number>>({});

    // Reset expansions when dbKey changes (optional but useful)
    useEffect(() => {
        setBcjExpandedCatalogs({});
        setBcjGroupsByCatalog({});
        setBcjExpandedGroups({});
        setBcjItemsByGroup({});
        setBcjLoadingByGroup({});
        setBcjErrorByGroup({});
        setBcjLimitByGroup({});

        setWkiExpandedGr({});
        setWkiExpandedPgr({});
        setWkiItemsByKey({});
        setWkiLoadingByKey({});
        setWkiErrorByKey({});
        setWkiLimitByKey({});
    }, [dbKey]);

    // ===== BCJ =====
    useEffect(() => {
        if (tab !== "BCJ") return;
        let mounted = true;

        (async () => {
            setBcjError(null);
            setBcjLoading(true);
            try {
                const res = await axiosInstance.get(`/api/sekocenbud/params/bcj/catalogs`, {
                    params: { db_key: dbKey },
                });
                const catalogs: string[] = res.data?.catalogs ?? [];
                if (mounted) setBcjCatalogs(catalogs);
            } catch (e: any) {
                if (mounted) setBcjError(e?.message ?? "Błąd ładowania katalogów BCJ");
            } finally {
                if (mounted) setBcjLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [tab, dbKey]);

    async function toggleBcjCatalog(catalog: string) {
        const next = !bcjExpandedCatalogs[catalog];
        setBcjExpandedCatalogs((prev) => ({ ...prev, [catalog]: next }));

        if (next && !bcjGroupsByCatalog[catalog]) {
            try {
                const res = await axiosInstance.get(`/api/sekocenbud/params/bcj/groups`, {
                    params: { db_key: dbKey, catalog },
                });
                const groups: BcjGroup[] = res.data?.groups ?? [];
                setBcjGroupsByCatalog((prev) => ({ ...prev, [catalog]: groups }));
            } catch (e: any) {
                setBcjError(e?.message ?? `Błąd ładowania grup dla katalogu ${catalog}`);
            }
        }
    }

    async function fetchBcjItems(catalog: string, groupUuid: string) {
        setBcjLoadingByGroup((prev) => ({ ...prev, [groupUuid]: true }));
        setBcjErrorByGroup((prev) => ({ ...prev, [groupUuid]: undefined }));

        try {
            const res = await axiosInstance.get(`/api/sekocenbud/search/bcj`, {
                params: {
                    db_key: dbKey,
                    search: DEFAULT_SEARCH,
                    catalog,
                    group: groupUuid,
                },
            });
            const rows: any[] = Array.isArray(res.data) ? res.data : [];
            setBcjItemsByGroup((prev) => ({ ...prev, [groupUuid]: rows }));
            setBcjLimitByGroup((prev) => ({ ...prev, [groupUuid]: PAGE_SIZE }));
        } catch (e: any) {
            setBcjErrorByGroup((prev) => ({ ...prev, [groupUuid]: e?.message ?? "Błąd pobierania pozycji BCJ" }));
            setBcjItemsByGroup((prev) => ({ ...prev, [groupUuid]: [] }));
        } finally {
            setBcjLoadingByGroup((prev) => ({ ...prev, [groupUuid]: false }));
        }
    }

    function toggleBcjGroup(catalog: string, groupUuid: string) {
        const next = !bcjExpandedGroups[groupUuid];
        setBcjExpandedGroups((prev) => ({ ...prev, [groupUuid]: next }));
        if (next && bcjItemsByGroup[groupUuid] === undefined) {
            fetchBcjItems(catalog, groupUuid);
        }
    }

    function showMoreBcj(groupUuid: string) {
        setBcjLimitByGroup((prev) => ({ ...prev, [groupUuid]: (prev[groupUuid] ?? PAGE_SIZE) + PAGE_SIZE }));
    }

    // ===== WKI =====
    function keyFor(gr: number, pgr: number) {
        return `${gr}-${pgr}`;
    }

    async function fetchWkiItems(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        setWkiLoadingByKey((prev) => ({ ...prev, [key]: true }));
        setWkiErrorByKey((prev) => ({ ...prev, [key]: undefined }));

        try {
            const res = await axiosInstance.get(`/api/sekocenbud/search/wki`, {
                params: {
                    db_key: dbKey,
                    gr,
                    pgr,
                    search: DEFAULT_SEARCH,
                },
            });
            const rows: WkiRow[] = Array.isArray(res.data) ? res.data : [];
            setWkiItemsByKey((prev) => ({ ...prev, [key]: rows }));
            setWkiLimitByKey((prev) => ({ ...prev, [key]: PAGE_SIZE }));
        } catch (e: any) {
            setWkiErrorByKey((prev) => ({ ...prev, [key]: e?.message ?? "Błąd pobierania danych WKI" }));
            setWkiItemsByKey((prev) => ({ ...prev, [key]: [] }));
        } finally {
            setWkiLoadingByKey((prev) => ({ ...prev, [key]: false }));
        }
    }

    function toggleWkiPgr(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        const next = !wkiExpandedPgr[key];
        setWkiExpandedPgr((prev) => ({ ...prev, [key]: next }));
        if (next && wkiItemsByKey[key] === undefined) {
            fetchWkiItems(gr, pgr);
        }
    }

    function showMoreWki(gr: number, pgr: number) {
        const key = keyFor(gr, pgr);
        setWkiLimitByKey((prev) => ({ ...prev, [key]: (prev[key] ?? PAGE_SIZE) + PAGE_SIZE }));
    }

    // ===== Render helpers =====
    function renderLeafRow(row: any, source: "BCJ" | "WKI", idx: number) {
        const symbol = row.SYMBOL ?? row.symbol ?? "";
        const opis = row.OPIS ?? row.opis ?? "";
        const jm = row.JM_NAZWA ?? row.JM ?? row.unit ?? "";
        const cena = row.CENA_SR ?? row.cena_sr ?? row.price ?? "";

        return (
            <li key={idx} className="px-2 py-1 rounded hover:bg-gray-50 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono">{symbol}</span>
                        {jm ? <span className="text-xs text-gray-500">({String(jm)})</span> : null}
                        {cena !== "" ? <span className="text-xs text-gray-500">• {String(cena)} zł</span> : null}
                    </div>
                    <div className="text-gray-700 break-words">{opis}</div>
                </div>

                <button
                    className="shrink-0 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPickRow?.(row, source);
                    }}
                    title="Dodaj do kosztorysu"
                >
                    Dodaj
                </button>
            </li>
        );
    }

    const headerLabel = useMemo(() => {
        return `Baza: ${dbKey}`;
    }, [dbKey]);

    return (
        <div className="flex flex-col gap-3">
            <div className="text-xs text-gray-500">{headerLabel}</div>

            {/* Zakładki */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setTab("BCJ")}
                    className={`px-3 py-1 rounded ${tab === "BCJ" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                >
                    BCJ
                </button>
                <button
                    onClick={() => setTab("WKI")}
                    className={`px-3 py-1 rounded ${tab === "WKI" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                >
                    WKI
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
                                                            {groups.map((g) => {
                                                                const gExpanded = !!bcjExpandedGroups[g.uuid];
                                                                const items = bcjItemsByGroup[g.uuid];
                                                                const loading = !!bcjLoadingByGroup[g.uuid];
                                                                const error = bcjErrorByGroup[g.uuid];
                                                                const limit = bcjLimitByGroup[g.uuid] ?? PAGE_SIZE;

                                                                return (
                                                                    <li key={g.uuid}>
                                                                        <button
                                                                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 border border-gray-200"
                                                                            onClick={() => toggleBcjGroup(cat, g.uuid)}
                                                                            title="Rozwiń pozycje w grupie"
                                                                        >
                                                                            <span className="mr-2">{gExpanded ? "▾" : "▸"}</span>
                                                                            <span className="font-mono mr-2">{g.symbol}</span>
                                                                            <span>{g.opis}</span>
                                                                        </button>

                                                                        {gExpanded && (
                                                                            <div className="ml-4 mt-1">
                                                                                {loading && <div>Ładowanie pozycji…</div>}
                                                                                {error && <div className="text-red-600">Błąd: {error}</div>}
                                                                                {items && items.length === 0 && !loading && !error && (
                                                                                    <div className="text-gray-500">Brak pozycji</div>
                                                                                )}
                                                                                {items && items.length > 0 && (
                                                                                    <>
                                                                                        <ul className="space-y-0.5">
                                                                                            {items.slice(0, limit).map((row, idx) =>
                                                                                                renderLeafRow(row, "BCJ", idx)
                                                                                            )}
                                                                                        </ul>

                                                                                        {items.length > limit && (
                                                                                            <button
                                                                                                className="mt-2 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                                                                                                onClick={() => showMoreBcj(g.uuid)}
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
                                            onClick={() => setWkiExpandedGr((prev) => ({ ...prev, [gr]: !expanded }))}
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
                                                                                    {items.slice(0, limit).map((row, idx) => renderLeafRow(row, "WKI", idx))}
                                                                                </ul>

                                                                                {items.length > limit && (
                                                                                    <button
                                                                                        className="mt-2 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                                                                                        onClick={() => showMoreWki(gr, pgr)}
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