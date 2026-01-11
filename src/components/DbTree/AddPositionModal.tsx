import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axios";

type ProjectGroup = { id: number; name: string };

type Props = {
    open: boolean;
    onClose: () => void;
    projectGroups: ProjectGroup[];
    onPick: (row: any, source: "BCJ" | "WKI", quantity: number, groupId: number) => void;
};

type Tab = "BCJ" | "WKI";

type BcjGroup = {
    uuid: string;
    catalog: string;
    symbol: string;
    opis: string;
};


const DB_KEY = "224";
const WKI_GR = [1, 2, 3, 4, 5, 6, 7];
const WKI_PGR = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const PAGE_SIZE = 200;

// Safely evaluate mathematical expressions (e.g., "3*3", "5+6")
function evaluateExpression(expr: string): number | null {
    try {
        // Remove whitespace
        const cleaned = expr.trim();
        
        // If it's just a number, return it
        const directNumber = parseFloat(cleaned);
        if (!isNaN(directNumber) && cleaned === directNumber.toString()) {
            return directNumber;
        }
        
        // Only allow numbers, operators, parentheses, and decimal points
        if (!/^[0-9+\-*/().,\s]+$/.test(cleaned)) {
            return null;
        }
        
        // Replace commas with dots for decimal numbers
        const normalized = cleaned.replace(/,/g, '.');
        
        // Evaluate the expression using Function constructor (safer than eval)
        const result = new Function(`return ${normalized}`)();
        
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return result;
        }
        
        return null;
    } catch {
        return null;
    }
}

// --- utils: NORMA-like parsing/matching (AND + wykluczenia + frazy + wildcards * ? + bez polskich znaków)
function stripDiacritics(s: string) {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type QueryToken = { type: "phrase" | "word" | "wildcard"; value: string; neg?: boolean };

function parseQuery(q: string): QueryToken[] {
    const tokens: QueryToken[] = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = re.exec(q))) {
        const phrase = m[1];
        const raw = (phrase ?? m[2] ?? "").trim();
        if (!raw) continue;
        const neg = raw.startsWith("-");
        const core = neg ? raw.slice(1) : raw;
        if (phrase) {
            tokens.push({ type: "phrase", value: phrase, neg });
        } else if (/[*?]/.test(core)) {
            tokens.push({ type: "wildcard", value: core, neg });
        } else {
            tokens.push({ type: "word", value: core, neg });
        }
    }
    return tokens;
}

function wildcardToRegExp(wc: string): RegExp {
    const esc = wc.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(esc, "i");
}

function matchesNORMA(row: any, tokens: QueryToken[]) {
    const symbol = String(row.SYMBOL ?? row.symbol ?? "");
    const opis = String(row.OPIS ?? row.opis ?? "");
    const hay = stripDiacritics((symbol + " " + opis).toLowerCase());

    for (const t of tokens) {
        const val = stripDiacritics(t.value.toLowerCase());
        let hit = false;
        if (t.type === "phrase") hit = hay.includes(val);
        else if (t.type === "word") hit = hay.includes(val);
        else hit = wildcardToRegExp(val).test(hay);

        if (t.neg) {
            if (hit) return false;
        } else if (!hit) {
            return false;
        }
    }
    return true;
}

function rankRow(row: any, q: string) {
    const s = String(row.SYMBOL ?? "").toLowerCase();
    const o = String(row.OPIS ?? "").toLowerCase();
    const qq = q.toLowerCase();
    if (s.startsWith(qq)) return 3;
    if (s.includes(qq)) return 2;
    if (o.includes(qq)) return 1;
    return 0;
}

export default function AddPositionModal({ open, onClose, onPick, projectGroups }: Props) {
    const [tab, setTab] = useState<Tab>("BCJ");
    const [search, setSearch] = useState("");
    const tokens = useMemo(() => parseQuery(search), [search]);

    const UNGROUPED_ID = 0;
    const [targetGroupId, setTargetGroupId] = useState<number>(UNGROUPED_ID);

    // BCJ: katalog/grupa
    const [catalogs, setCatalogs] = useState<string[]>([]);
    const [catalog, setCatalog] = useState<string>("");
    const [groups, setGroups] = useState<BcjGroup[]>([]);
    const [group, setGroup] = useState<string>("");
    const [loadingFilters, setLoadingFilters] = useState(false);

    // Wyniki
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [limit, setLimit] = useState(PAGE_SIZE);

    // Ilości (NORMA-like) — przechowujemy per wiersz
    const [qty, setQty] = useState<Record<number, string>>({});

    useEffect(() => {
        if (!open) return;
        setError(null);
        setRows([]);
        setLimit(PAGE_SIZE);
        setQty({});
        setTargetGroupId(UNGROUPED_ID);

        if (tab === "BCJ") {
            setLoadingFilters(true);
            axiosInstance
                .get(`/api/sekocenbud/params/bcj/catalogs`, { params: { db_key: DB_KEY } })
                .then((res) => setCatalogs(res.data?.catalogs ?? []))
                .catch(() => setCatalogs([]))
                .finally(() => setLoadingFilters(false));
        }
    }, [open, tab]);

    useEffect(() => {
        if (!catalog) {
            setGroups([]);
            setGroup("");
            return;
        }
        setLoadingFilters(true);
        axiosInstance
            .get(`/api/sekocenbud/params/bcj/groups`, { params: { db_key: DB_KEY, catalog } })
            .then((res) => setGroups(res.data?.groups ?? []))
            .catch(() => setGroups([]))
            .finally(() => setLoadingFilters(false));
    }, [catalog]);

    function buildSearchQuery(): string {
        // Get all positive (non-excluded) tokens
        const positives = tokens.filter((t) => !t.neg);
        
        // Extract search terms (skip wildcards for backend query)
        const terms = positives
            .filter((t) => t.type !== "wildcard")
            .map((t) => t.value);
        
        // Join with + for backend, or use raw search if no valid tokens
        if (terms.length > 0) {
            return terms.join("+");
        }
        
        // Fallback: use raw search or a default
        return search.trim() || "a";
    }

    async function runSearch() {
        setLoading(true);
        setError(null);
        setRows([]);
        setLimit(PAGE_SIZE);
        setQty({});

        const searchQuery = buildSearchQuery();

        try {
            if (tab === "BCJ") {
                const res = await axiosInstance.get(`/api/sekocenbud/search/bcj`, {
                    params: {
                        db_key: DB_KEY,
                        search: searchQuery,
                        ...(catalog ? { catalog } : {}),
                        ...(group ? { group } : {}),
                    },
                });
                const list: any[] = Array.isArray(res.data) ? res.data : [];
                setRows(list);
            } else {
                const res = await axiosInstance.get(`/api/sekocenbud/search/wki`, {
                    params: { db_key: DB_KEY, search: searchQuery },
                });
                const list: any[] = Array.isArray(res.data) ? res.data : [];
                setRows(list);
            }
        } catch (e: any) {
            setError(e?.message ?? "Błąd wyszukiwania");
        } finally {
            setLoading(false);
        }
    }

    function resetAndClose() {
        setSearch("");
        setRows([]);
        setError(null);
        setLimit(PAGE_SIZE);
        setCatalog("");
        setGroups([]);
        setGroup("");
        setQty({});
        onClose();
    }

    return (
        <div className={`fixed inset-0 z-[1000] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
            {/* backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
                onClick={resetAndClose}
            />
            {/* dialog */}
            <div
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(1100px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-lg transition-all ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
            >
                <div className="border-b px-5 py-3 flex items-center gap-2">
                    <button
                        className={`px-3 py-1 rounded ${tab === "BCJ" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                        onClick={() => setTab("BCJ")}
                    >
                        BCJ (2024)
                    </button>
                    <button
                        className={`px-3 py-1 rounded ${tab === "WKI" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                        onClick={() => setTab("WKI")}
                    >
                        WKI (2024)
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                        <select
                            className="border rounded px-2 py-1 min-w-[220px]"
                            value={targetGroupId}
                            onChange={(e) => setTargetGroupId(Number(e.target.value))}
                            title="Podgrupa docelowa"
                        >
                            {(projectGroups ?? []).map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name}
                                </option>
                            ))}
                        </select>

                        <input
                            className="border rounded px-3 py-1 w-[360px]"
                            placeholder='Szukaj (NORMA: "fraza", słowo1 słowo2, *dzikie?, -wyklucz)'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && runSearch()}
                        />
                        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={runSearch}>
                            Szukaj
                        </button>
                        <button className="px-3 py-1 rounded bg-gray-100" onClick={resetAndClose}>
                            Zamknij
                        </button>
                    </div>
                </div>

                {/* Filtry */}
                <div className="px-5 py-3 border-b text-sm">
                    {tab === "BCJ" ? (
                        <div className="flex items-center gap-3 flex-wrap">
                            <div>
                                <label className="block text-xs text-gray-500">Katalog</label>
                                <select
                                    className="border rounded px-2 py-1 min-w-[180px]"
                                    value={catalog}
                                    onChange={(e) => setCatalog(e.target.value)}
                                >
                                    <option value="">(wszystkie)</option>
                                    {catalogs.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Grupa</label>
                                <select
                                    className="border rounded px-2 py-1 min-w-[260px]"
                                    value={group}
                                    onChange={(e) => setGroup(e.target.value)}
                                    disabled={!catalog || loadingFilters}
                                >
                                    <option value="">(wszystkie)</option>
                                    {groups.map((g) => (
                                        <option key={g.uuid} value={g.uuid}>
                                            {g.symbol} — {g.opis}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {loadingFilters && <span className="text-gray-500">Ładowanie filtrów…</span>}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500">
                            *WKI: na razie szukamy po całej bazie 2024 (filtry GR/PGR dołączymy później).
                        </div>
                    )}
                </div>

                {/* Wyniki */}
                <div className="p-5 overflow-auto" style={{ maxHeight: "calc(85vh - 160px)" }}>
                    {loading && <div>Ładowanie wyników…</div>}
                    {error && <div className="text-red-600">Błąd: {error}</div>}
                    {!loading && !error && rows.length === 0 && (
                        <div className="text-gray-500">Brak wyników. Spróbuj innej frazy.</div>
                    )}
                    {!loading && rows.length > 0 && (
                        <>
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2 w-40">Symbol</th>
                                    <th className="text-left p-2">Opis</th>
                                    <th className="text-left p-2 w-24">JM</th>
                                    <th className="text-left p-2 w-24">Cena śr.</th>
                                    <th className="text-left p-2 w-32">Ilość</th>
                                    <th className="text-left p-2 w-28"></th>
                                </tr>
                                </thead>
                                <tbody>
                                {rows.slice(0, limit).map((r, idx) => {
                                    const symbol = r.SYMBOL ?? r.symbol ?? "";
                                    const opis = r.OPIS ?? r.opis ?? "";
                                    const jm = r.JM_NAZWA ?? r.JM ?? "";
                                    const cena = r.CENA_SR ?? r.cena_sr ?? "";
                                    const qv = qty[idx] ?? "1";

                                    return (
                                        <tr key={idx} className="border-b hover:bg-gray-50">
                                            <td className="p-2 font-mono">{symbol}</td>
                                            <td className="p-2">{opis}</td>
                                            <td className="p-2">{String(jm)}</td>
                                            <td className="p-2">{String(cena)}</td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        className="border rounded px-2 py-1 w-24"
                                                        placeholder="np. 3*3"
                                                        value={qv}
                                                        onChange={(e) => setQty((prev) => ({ ...prev, [idx]: e.target.value }))}
                                                    />
                                                    <span className="text-xs text-gray-500">{jm}</span>
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    className="px-2 py-1 text-xs rounded bg-emerald-600 text-white"
                                                    onClick={() => {
                                                        const evaluated = evaluateExpression(qv);
                                                        const q = evaluated !== null && evaluated > 0 ? evaluated : 1;
                                                        onPick(r, tab, q, targetGroupId);
                                                    }}
                                                >
                                                    Dodaj
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>

                            {rows.length > limit && (
                                <div className="mt-3">
                                    <button
                                        className="px-3 py-1 text-xs rounded border"
                                        onClick={() => setLimit((x) => x + PAGE_SIZE)}
                                    >
                                        Pokaż więcej ({limit}/{rows.length})
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
