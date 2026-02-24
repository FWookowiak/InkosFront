import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectSummary } from "@/contexts/ProjectSummaryContext";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { Link, useNavigate, useLocation, matchPath } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, X } from "lucide-react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";

type LocalGroup = { id: number; name: string; color?: string };
type LocalElement = {
    value?: number;
    group?: number | null;
    isTax?: boolean;
};

type LocalProjectContent = {
    version?: number;
    groups?: LocalGroup[];
    elements?: LocalElement[];
};

function storageKey(projectId: string) {
    return `project:${projectId}:content`;
}

function readLocalContent(projectId: string): LocalProjectContent | null {
    try {
        const raw = localStorage.getItem(storageKey(projectId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
        return null;
    } catch {
        return null;
    }
}

export default function Topbar() {
    const { user, logout, isAuthenticated } = useAuth();
    const { summaryData, refetchProject, openGroupSettings, openAddElement, openAddTax } =
        useProjectSummary();

    const navigate = useNavigate();
    const location = useLocation();

    const projectMatch = matchPath("/project/:id", location.pathname);
    const projectId = projectMatch?.params?.id;

    // traktujemy /project/new jako NIE-projekt
    const isProjectPage = Boolean(projectMatch && projectId && projectId !== "new");

    const [selectedQuarter, setSelectedQuarter] = useState("Wybierz kwartał");
    const [selectedWspreg, setSelectedWspreg] = useState("Wybierz WSPREG");
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [isRepricing, setIsRepricing] = useState(false);

    const [quarters, setQuarters] = useState<Array<{ db_key: string; name: string }>>([]);
    const [wspregs, setWspregs] = useState<Record<string, number>>({});

    // ===== PODSUMOWANIE (bardziej rozbudowane) =====
    const wspregValue = summaryData?.wspreg_value ?? 1.0;

    const [summaryGroups, setSummaryGroups] = useState<Array<{ id: number; name: string; total: number }>>([]);
    const [summaryTotal, setSummaryTotal] = useState<number>(0);
    const [summaryGroupsCount, setSummaryGroupsCount] = useState<number>(0);

    useEffect(() => {
        if (!summaryModalOpen) return;
        if (!projectId || !isProjectPage) return;

        const local = readLocalContent(projectId);

        const groups = Array.isArray(local?.groups) ? local!.groups! : [];
        const elements = Array.isArray(local?.elements) ? local!.elements! : [];

        // Zliczaj jak tabela: wspreg mnoży tylko NIE-podatki; podatki bez mnożenia
        const valueForSummary = (el: LocalElement) => {
            const v = Number(el.value) || 0;
            if (el.isTax) return v;
            if (wspregValue === 1.0) return v;
            return Number((v * wspregValue).toFixed(2));
        };

        const totalsMap = new Map<number, number>();
        for (const el of elements) {
            const gid = typeof el.group === "number" ? el.group : 0;
            totalsMap.set(gid, (totalsMap.get(gid) ?? 0) + valueForSummary(el));
        }

        // uporządkuj wg kolejności w groups, a jak nie ma, to wg id
        const ordered = (groups.length ? groups : [{ id: 0, name: "Brak podgrupy" }])
            .slice()
            .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
            .map((g) => ({
                id: g.id,
                name: g.name,
                total: Number((totalsMap.get(g.id) ?? 0).toFixed(2)),
            }));

        // total projektu (wszystkie grupy)
        const total = Array.from(totalsMap.values()).reduce((a, b) => a + b, 0);

        // liczba PODGRUP (bez 0)
        const subgroupsCount = ordered.filter((g) => g.id !== 0).length;

        // pokaż tylko te, które mają koszt > 0, ale zachowaj kolejność
        const filtered = ordered.filter((g) => g.total !== 0);

        setSummaryGroups(filtered);
        setSummaryTotal(Number(total.toFixed(2)));
        setSummaryGroupsCount(subgroupsCount);
    }, [summaryModalOpen, projectId, isProjectPage, wspregValue]);

    // ===== LISTA KWARTAŁÓW / WSPREG =====
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchQuarters = async () => {
            try {
                const response = await axiosInstance.get("/api/sekocenbud/dbfs");
                setQuarters(response.data);
            } catch (error) {
                console.error("Error fetching quarters:", error);
                toast.error("Nie udało się pobrać listy kwartałów", { duration: 7000, closeButton: true });
            }
        };

        fetchQuarters();
    }, [isAuthenticated]);

    useEffect(() => {
        if (summaryData?.sekocenbud_catalog && quarters.length > 0) {
            const matching = quarters.find((q) => q.db_key === summaryData.sekocenbud_catalog);
            if (matching) setSelectedQuarter(matching.name);
        }
    }, [summaryData?.sekocenbud_catalog, quarters]);

    useEffect(() => {
        if (!summaryData?.sekocenbud_catalog) return;

        const fetchWspregs = async () => {
            try {
                const response = await axiosInstance.get(`/api/sekocenbud/wspreg?db_key=${summaryData.sekocenbud_catalog}`);
                setWspregs(response.data);
            } catch (error) {
                console.error("Error fetching wspreg data:", error);
                toast.error("Nie udało się pobrać listy WSPREG", { duration: 7000, closeButton: true });
            }
        };

        fetchWspregs();
    }, [summaryData?.sekocenbud_catalog]);

    useEffect(() => {
        if (summaryData?.wspreg_name && summaryData.wspreg_name !== "Brak") setSelectedWspreg(summaryData.wspreg_name);
        else setSelectedWspreg("Wybierz WSPREG");
    }, [summaryData?.wspreg_name]);

    // IMPORTANT: dopiero PO hookach wolno robić early return
    if (!isAuthenticated) return null;

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleQuarterChange = async (dbKey: string, name: string) => {
        if (!projectId || !isProjectPage) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }

        setIsRepricing(true);
        try {
            await axiosInstance.post(`/api/projects/${projectId}/reprice/`, { sekocenbud_catalog: dbKey });

            if (refetchProject) await refetchProject();

            toast.success(`Zmieniono kwartał na ${name} i zaktualizowano ceny`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error("Error updating quarter:", error);
            toast.error("Nie udało się zmienić kwartału", { duration: 7000, closeButton: true });
        } finally {
            setIsRepricing(false);
        }
    };

    const handleWspregChange = async (name: string, value: number) => {
        if (!projectId || !isProjectPage) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }

        try {
            await axiosInstance.patch(`/api/projects/${projectId}/`, { wspreg_name: name, wspreg_value: value });
            setSelectedWspreg(name);
            if (refetchProject) await refetchProject();
            toast.success(`Zastosowano WSPREG: ${name} (×${value})`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error("Error applying wspreg:", error);
            toast.error("Nie udało się zastosować WSPREG", { duration: 7000, closeButton: true });
        }
    };

    const handleResetWspreg = async () => {
        if (!projectId || !isProjectPage) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }

        try {
            await axiosInstance.patch(`/api/projects/${projectId}/`, { wspreg_name: "Brak", wspreg_value: 1.0 });
            setSelectedWspreg("Wybierz WSPREG");
            if (refetchProject) await refetchProject();
            toast.success("Zresetowano WSPREG do wartości domyślnej", { duration: 7000, closeButton: true });
        } catch (error) {
            console.error("Error resetting wspreg:", error);
            toast.error("Nie udało się zresetować WSPREG", { duration: 7000, closeButton: true });
        }
    };

    const handleExport = async (format: "pdf" | "excel" | "csv") => {
        if (!projectId || !isProjectPage) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }

        try {
            const response = await axiosInstance.get(`/api/projects/${projectId}/export/${format}`, { responseType: "blob" });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;

            const extension = format === "excel" ? "xlsx" : format;
            link.setAttribute("download", `project-${projectId}.${extension}`);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Plik ${format.toUpperCase()} został pobrany`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error("Export error:", error);
            toast.error(`Błąd podczas eksportu do ${format.toUpperCase()}`, { duration: 7000, closeButton: true });
        }
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 bg-background z-50 px-6 py-3 border-b shadow-sm flex justify-between items-center">
                {/* Lewa strona */}
                <div className="flex items-center gap-4">
                    <Link to="/">
                        <div className="p-2 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                            <img src={logo} alt="Logo" className="h-10 w-auto" />
                        </div>
                    </Link>

                    {isProjectPage && (
                        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                            ← Wróć do projektów
                        </Button>
                    )}
                </div>

                {/* Środek */}
                {isProjectPage && (
                    <div className="flex items-center gap-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Plik</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSummaryModalOpen(true)}>Podsumowanie</DropdownMenuItem>
                                <DropdownMenuItem onClick={openGroupSettings}>Ustawienia Grup</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Eksport</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport("pdf")}>PDF</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("excel")}>Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("csv")}>CSV</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Wstaw</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={openAddElement}>Wstaw własny Element</DropdownMenuItem>
                                <DropdownMenuItem onClick={openAddTax}>Wstaw Podatek</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">{selectedQuarter}</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {quarters.map((q) => (
                                    <DropdownMenuItem key={q.db_key} onClick={() => handleQuarterChange(q.db_key, q.name)}>
                                        {q.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">{selectedWspreg}</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
                                    {Object.entries(wspregs).map(([name, value]) => (
                                        <DropdownMenuItem key={name} onClick={() => handleWspregChange(name, value)}>
                                            {name} ({value.toFixed(2)})
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {selectedWspreg !== "Wybierz WSPREG" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={handleResetWspreg}>
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Prawa strona */}
                <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">Zalogowano: {user?.name}</span>

                    {location.pathname === "/dashboard" && (
                        <Button variant="default" onClick={() => navigate("/project/new")}>
                            ➕ Dodaj projekt
                        </Button>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate("/konto")}>Konto</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate("/kontakt")}>Kontakt</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                Wyloguj
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Summary Modal */}
            <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
                <DialogContent className="sm:max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle>Podsumowanie projektu</DialogTitle>
                        <DialogDescription>Podgrupy wraz z kosztami + łączny koszt.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium">Liczba podgrup:</span>
                            <span className="text-lg">{summaryGroupsCount}</span>
                        </div>

                        <div className="rounded-md border">
                            <div className="px-3 py-2 text-sm font-medium bg-muted/40 border-b">Koszty podgrup</div>

                            {summaryGroups.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-muted-foreground">Brak danych (albo projekt nie ma jeszcze pozycji).</div>
                            ) : (
                                <div className="divide-y">
                                    {summaryGroups.map((g) => (
                                        <div key={g.id} className="px-3 py-2 flex justify-between items-center">
                                            <span className="text-sm">{g.name}</span>
                                            <span className="text-sm font-semibold tabular-nums">
                        {g.total.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                      </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center border-t pt-3">
                            <span className="font-semibold text-lg">Łączny koszt:</span>
                            <span className="text-xl font-bold text-primary tabular-nums">
                {summaryTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
              </span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Loading Modal for Reprice */}
            <Dialog open={isRepricing} onOpenChange={() => {}}>
                <DialogContent
                    className="sm:max-w-md"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Przeliczanie cen...</DialogTitle>
                        <DialogDescription>Trwa aktualizacja cen projektów. Proszę czekać.</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}