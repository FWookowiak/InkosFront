// src/pages/ProjectPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../lib/axios";
import ElementsTable from "@/components/ElementsTable/ElementsTable";
import DbTree from "@/components/DbTree/DbTree";
import AddPositionModal from "@/components/DbTree/AddPositionModal";
import GroupSettingsModal from "@/components/GroupSettingsModal/GroupSettingsModal";
import AddElementModal from "@/components/AddElementModal/AddElementModal";
import AddTaxModal from "@/components/AddTaxModal/AddTaxModal";
import QuickAddFromTreeModal from "@/components/DbTree/QuickAddFromTreeModal";
import { toast } from "sonner";
import { useProjectSummary } from "@/contexts/ProjectSummaryContext";
import { useProjectData } from "@/hooks/useProjectData";

type ContentSnapshot = {
    version?: number;
    groups?: any[];
    elements?: any[];
};

const storageKey = (projectId: string) => `project:${projectId}:content`;

function getContentSnapshot(projectId: string, fallback: ContentSnapshot): ContentSnapshot {
    try {
        const raw = localStorage.getItem(storageKey(projectId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch {}
    return fallback;
}

function round2(n: any) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Number(x.toFixed(2));
}

// Ujednolicamy elementy przed wysłaniem do backendu (żeby nie wysyłać _id/clientId/kind itd.)
function normalizeElementForApi(el: any) {
    const isTax = el?.isTax === true;

    const groupRaw = el?.group;
    const group =
        groupRaw === 0 || groupRaw === "0"
            ? null
            : typeof groupRaw === "number"
                ? groupRaw
                : groupRaw == null
                    ? null
                    : Number.isFinite(Number(groupRaw))
                        ? Number(groupRaw)
                        : null;

    const base: any = {
        id: el?.id ?? null,
        symbol: String(el?.symbol ?? ""),
        name: String(el?.name ?? ""),
        unit: String(el?.unit ?? "szt"),
        quantity: Number(el?.quantity ?? 1) || 1,
        price: round2(el?.price ?? 0),
        value: round2(el?.value ?? 0),
        group,
    };

    if (isTax) {
        base.isTax = true;
        if (typeof el?.taxPercentage === "number") base.taxPercentage = el.taxPercentage;
        if (el?.taxTarget === null || typeof el?.taxTarget === "number") base.taxTarget = el.taxTarget;
    }

    if (typeof el?.order === "number") base.order = el.order;

    return base;
}

function normalizeContentForApi(snap: ContentSnapshot) {
    const groups = Array.isArray(snap.groups) ? snap.groups : [];
    const elements = Array.isArray(snap.elements) ? snap.elements : [];

    const seen = new Set<number>();
    const normGroups = groups
        .map((g: any) => ({
            id: Number(g?.id ?? 0),
            name: String(g?.name ?? ""),
            color: g?.color ?? undefined,
        }))
        .filter((g: any) => Number.isFinite(g.id))
        .filter((g: any) => {
            if (seen.has(g.id)) return false;
            seen.add(g.id);
            return true;
        });

    const normElements = elements.map(normalizeElementForApi);

    return { ...snap, groups: normGroups, elements: normElements };
}

const ProjectPage = () => {
    const projectId = window.location.pathname.split("/").pop() as string;

    const { data, loading, elements: apiElements, groups: apiGroups, content, refetch } =
        useProjectData(projectId);

    const {
        setSummaryData,
        setRefetchProject,
        groupSettingsOpenTrigger,
        addElementOpenTrigger,
        addTaxOpenTrigger,
    } = useProjectSummary();

    const [sidebarWidth, setSidebarWidth] = useState(300);
    const resizerRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef(false);

    const [tableVersion, setTableVersion] = useState(0);

    const [addOpen, setAddOpen] = useState(false);
    const [addElementOpen, setAddElementOpen] = useState(false);
    const [addTaxOpen, setAddTaxOpen] = useState(false);
    const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

    // ✅ Quick add from DbTree (left)
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [pendingRow, setPendingRow] = useState<any | null>(null);
    const [pendingSource, setPendingSource] = useState<"BCJ" | "WKI" | null>(null);

    // refetch do kontekstu (Topbar)
    useEffect(() => {
        setRefetchProject(() => () => refetch());
        return () => setRefetchProject(null);
    }, [refetch, setRefetchProject]);

    // ✅ Podsumowanie: liczymy “z podatkami” i “bez podatków”
    useEffect(() => {
        if (!data) {
            setSummaryData(null);
            return;
        }

        const elements = Array.isArray(apiElements) ? apiElements : [];
        const groups = Array.isArray(apiGroups) ? apiGroups : [];

        const isTax = (el: any) => el?.isTax === true;

        const sumValue = (arr: any[]) =>
            round2(arr.reduce((acc, el) => acc + (Number(el?.value) || 0), 0));

        const totalInclTax = sumValue(elements);
        const totalExclTax = sumValue(elements.filter((e) => !isTax(e)));

        const mapIncl = new Map<number, number>();
        const mapExcl = new Map<number, number>();

        for (const el of elements) {
            const gid = Number(el?.group ?? 0);
            mapIncl.set(gid, round2((mapIncl.get(gid) ?? 0) + (Number(el?.value) || 0)));

            if (!isTax(el)) {
                mapExcl.set(gid, round2((mapExcl.get(gid) ?? 0) + (Number(el?.value) || 0)));
            }
        }

        const subgroupCostsInclTax = groups
            .filter((g: any) => Number(g?.id) !== 0)
            .map((g: any) => ({
                id: Number(g.id),
                name: String(g?.name ?? `Podgrupa ${g.id}`),
                total: round2(mapIncl.get(Number(g.id)) ?? 0),
            }));

        const subgroupCostsExclTax = groups
            .filter((g: any) => Number(g?.id) !== 0)
            .map((g: any) => ({
                id: Number(g.id),
                name: String(g?.name ?? `Podgrupa ${g.id}`),
                total: round2(mapExcl.get(Number(g.id)) ?? 0),
            }));

        setSummaryData({
            total: totalInclTax,

            itemsCount: elements.length,
            groupsCount: groups.filter((g: any) => Number(g?.id) !== 0).length,

            projectId,
            projectName: data.name,
            sekocenbud_catalog: data.sekocenbud_catalog,
            wspreg_name: data.wspreg_name,
            wspreg_value: data.wspreg_value,

            totalInclTax,
            totalExclTax,
            subgroupCostsInclTax,
            subgroupCostsExclTax,
            ungroupedTotalInclTax: round2(mapIncl.get(0) ?? 0),
            ungroupedTotalExclTax: round2(mapExcl.get(0) ?? 0),
        });
    }, [data, apiElements, apiGroups, projectId, setSummaryData]);

    // ✅ Trigger modali: nie otwieraj “na starcie” jeśli trigger już >0 w kontekście
    const lastGroupSettingsTrigger = useRef<number>(groupSettingsOpenTrigger);
    const lastAddElementTrigger = useRef<number>(addElementOpenTrigger);
    const lastAddTaxTrigger = useRef<number>(addTaxOpenTrigger);

    useEffect(() => {
        if (groupSettingsOpenTrigger !== lastGroupSettingsTrigger.current) {
            lastGroupSettingsTrigger.current = groupSettingsOpenTrigger;
            if (groupSettingsOpenTrigger > 0) setGroupSettingsOpen(true);
        }
    }, [groupSettingsOpenTrigger]);

    useEffect(() => {
        if (addElementOpenTrigger !== lastAddElementTrigger.current) {
            lastAddElementTrigger.current = addElementOpenTrigger;
            if (addElementOpenTrigger > 0) setAddElementOpen(true);
        }
    }, [addElementOpenTrigger]);

    useEffect(() => {
        if (addTaxOpenTrigger !== lastAddTaxTrigger.current) {
            lastAddTaxTrigger.current = addTaxOpenTrigger;
            if (addTaxOpenTrigger > 0) setAddTaxOpen(true);
        }
    }, [addTaxOpenTrigger]);

    // Resizer
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < window.innerWidth - 200) setSidebarWidth(newWidth);
        };
        const handleMouseUp = () => {
            isResizingRef.current = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const startResizing = () => {
        isResizingRef.current = true;
    };

    function mapRowToElement(row: any, quantity: number, groupId: number) {
        const symbol = row.SYMBOL ?? row.symbol ?? "";
        const opis = row.OPIS ?? row.opis ?? "";
        const jm = row.JM_NAZWA ?? row.JM ?? "szt";
        const priceNum = Number((row.CENA_SR ?? row.cena_sr ?? 0).toString().replace(",", ".")) || 0;
        const qty = Number(quantity) || 1;

        return {
            id: null,
            symbol: String(symbol),
            name: String(opis),
            unit: String(jm),
            quantity: qty,
            price: round2(priceNum),
            value: round2(priceNum * qty),
            group: groupId === 0 ? null : groupId,
        };
    }

    // ✅ Najświeższe grupy do modali (żeby nie cofało nazw po dodaniu pozycji)
    const groupsForModals = useMemo(() => {
        const fallback: ContentSnapshot = {
            ...(content || {}),
            groups: Array.isArray(apiGroups) ? apiGroups : [],
            elements: Array.isArray(apiElements) ? apiElements : [],
        };
        const snap = getContentSnapshot(projectId, fallback);
        const norm = normalizeContentForApi(snap);

        const gs = Array.isArray(norm.groups) && norm.groups.length ? norm.groups : (Array.isArray(apiGroups) ? apiGroups : []);
        const has0 = gs.some((g: any) => Number(g?.id) === 0);
        return has0 ? gs : [{ id: 0, name: "Brak podgrupy" }, ...gs];
    }, [projectId, content, apiGroups, apiElements]);

    // ✅ DODAWANIE Z BAZY – ważne: nie nadpisuj grup starymi nazwami
    async function addPickedRow(row: any, _source: "BCJ" | "WKI", quantity: number, groupId: number) {
        try {
            const newEl = mapRowToElement(row, quantity, groupId);

            const snap = getContentSnapshot(projectId, (content || {}) as ContentSnapshot);
            const norm = normalizeContentForApi(snap);

            const currentElements = Array.isArray(norm.elements) ? norm.elements : [];
            const currentGroups =
                Array.isArray(norm.groups) && norm.groups.length ? norm.groups : (Array.isArray(apiGroups) ? apiGroups : []);

            const newContent = {
                ...norm,
                groups: currentGroups,
                elements: [...currentElements, newEl].map(normalizeElementForApi),
            };

            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            await refetch();
            setTableVersion((v) => v + 1);

            toast.success("Pozycja dodana do kosztorysu");
            setAddOpen(false);
        } catch (e: any) {
            const status = e?.response?.status;
            const data = e?.response?.data;
            console.error("[addPickedRow] FAILED", { status, data, raw: e });
            toast.error(String(data?.detail || "Nie udało się dodać pozycji"), { duration: 8000, closeButton: true });
        }
    }

    // ✅ WŁASNY ELEMENT
    async function addCustomElement(element: {
        name: string;
        symbol?: string;
        unit: string;
        quantity: number;
        price: number;
        value: number;
        group: number | null;
        clientId: string;
        kind?: string;
    }) {
        try {
            const snap = getContentSnapshot(projectId, (content || {}) as ContentSnapshot);
            const norm = normalizeContentForApi(snap);

            const currentElements = Array.isArray(norm.elements) ? norm.elements : [];
            const currentGroups =
                Array.isArray(norm.groups) && norm.groups.length ? norm.groups : Array.isArray(apiGroups) ? apiGroups : [];

            const safeElement = normalizeElementForApi({
                id: null,
                symbol: element.symbol ?? "",
                name: element.name,
                unit: element.unit,
                quantity: Number(element.quantity) || 1,
                price: round2(element.price),
                value: round2(element.value),
                group: element.group === 0 ? null : element.group,
            });

            const newContent = {
                ...norm,
                groups: currentGroups,
                elements: [...currentElements, safeElement].map(normalizeElementForApi),
            };

            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            await refetch();
            setTableVersion((v) => v + 1);

            toast.success("Element dodany pomyślnie");
        } catch (e: any) {
            const status = e?.response?.status;
            const data = e?.response?.data;
            console.error("[addCustomElement] FAILED", { status, data, raw: e });
            toast.error(String(data?.detail || "Nie udało się dodać elementu"), { duration: 8000, closeButton: true });
        }
    }

    // ✅ PODATEK
    async function addTax(taxElement: {
        name: string;
        symbol: string;
        unit: string;
        quantity: number;
        price: number;
        value: number;
        group: number | null;
        isTax: boolean;
        taxPercentage: number;
        taxTarget: number | null;
    }) {
        try {
            const snap = getContentSnapshot(projectId, (content || {}) as ContentSnapshot);
            const norm = normalizeContentForApi(snap);

            const currentElements = Array.isArray(norm.elements) ? norm.elements : [];
            const currentGroups =
                Array.isArray(norm.groups) && norm.groups.length ? norm.groups : Array.isArray(apiGroups) ? apiGroups : [];

            const safeTax = normalizeElementForApi({
                ...taxElement,
                id: null,
                group: taxElement.group === 0 ? null : taxElement.group,
            });

            const newContent = {
                ...norm,
                groups: currentGroups,
                elements: [...currentElements, safeTax].map(normalizeElementForApi),
            };

            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            await refetch();
            setTableVersion((v) => v + 1);

            toast.success("Podatek dodany pomyślnie");
        } catch (e: any) {
            const status = e?.response?.status;
            const data = e?.response?.data;
            console.error("[addTax] FAILED", { status, data, raw: e });
            toast.error(String(data?.detail || "Nie udało się dodać podatku"), { duration: 8000, closeButton: true });
        }
    }

    // Zapis kolejności grup
    const handleSaveGroupOrder = async (reorderedGroups: any[]) => {
        try {
            const snap = getContentSnapshot(projectId, (content || {}) as ContentSnapshot);
            const norm = normalizeContentForApi(snap);

            const currentElements = Array.isArray(norm.elements) ? norm.elements : [];
            const currentGroups = Array.isArray(norm.groups) ? norm.groups : [];

            const ungrouped = currentGroups.find((g: any) => Number(g?.id) === 0);
            const filtered = reorderedGroups.filter((g: any) => Number(g?.id) !== 0);

            const finalGroups = ungrouped ? [ungrouped, ...filtered] : filtered;

            const newContent = {
                ...norm,
                groups: finalGroups,
                elements: currentElements,
            };

            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });
            await refetch();
            setTableVersion((v) => v + 1);

            toast.success("Kolejność grup została zapisana");
        } catch (e: any) {
            const status = e?.response?.status;
            const data = e?.response?.data;
            console.error("[handleSaveGroupOrder] FAILED", { status, data, raw: e });
            toast.error(String(data?.detail || "Nie udało się zapisać kolejności grup"), { duration: 8000, closeButton: true });
        }
    };

    // Totale dla AddTaxModal (bazowe, bez podatków)
    const calculateGroupTotals = () => {
        const map = new Map<number, number>();
        const elements = Array.isArray(apiElements) ? apiElements : [];
        for (const el of elements) {
            if (el?.isTax) continue;
            const gid = Number(el?.group ?? 0);
            map.set(gid, round2((map.get(gid) ?? 0) + (Number(el?.value) || 0)));
        }
        return map;
    };

    const calculateProjectTotal = () => {
        const elements = Array.isArray(apiElements) ? apiElements : [];
        return round2(
            elements.reduce((acc, el) => {
                if (el?.isTax) return acc;
                return acc + (Number(el?.value) || 0);
            }, 0)
        );
    };

    const groupTotals = calculateGroupTotals();
    const projectTotal = calculateProjectTotal();

    // ✅ Klik “Dodaj” w drzewku
    const handlePickFromTree = (row: any, source: "BCJ" | "WKI") => {
        setPendingRow(row);
        setPendingSource(source);
        setQuickAddOpen(true);
    };

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-background to-muted/20 pt-24">
            <div className="flex h-full">
                {/* LEWA KOLUMNA: drzewo BCJ/WKI */}
                <aside className="bg-white shadow p-4 overflow-auto" style={{ width: sidebarWidth, minWidth: 200 }}>
                    <DbTree
                        dbKey={(data?.sekocenbud_catalog ?? "224").toString()}
                        onPickRow={handlePickFromTree}
                    />
                </aside>

                {/* Uchwyt */}
                <div
                    ref={resizerRef}
                    onMouseDown={startResizing}
                    className="cursor-col-resize bg-gray-300 hover:bg-gray-400 transition-colors"
                    style={{ width: 6 }}
                />

                {/* PRAWA KOLUMNA */}
                <main className="flex-1 p-4 pt-6">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{data?.name || "Projekt"}</h2>
                        <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" onClick={() => setAddOpen(true)}>
                            Dodaj pozycję
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-muted-foreground">Loading table...</p>
                    ) : (
                        <ElementsTable
                            key={`et-${projectId}-${tableVersion}`}
                            projectId={projectId}
                            elements={apiElements}
                            initialGroups={apiGroups}
                            initialContent={content}
                            wspregValue={data?.wspreg_value ?? 1.0}
                        />
                    )}
                </main>
            </div>

            {/* Modal dodawania pozycji z bazy */}
            <AddPositionModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                projectGroups={groupsForModals}
                onPick={addPickedRow}
            />

            {/* ✅ Quick modal dla drzewka */}
            <QuickAddFromTreeModal
                open={quickAddOpen}
                onClose={() => setQuickAddOpen(false)}
                projectGroups={groupsForModals}
                row={pendingRow}
                source={pendingSource}
                onConfirm={(qty, gid) => {
                    if (!pendingRow || !pendingSource) return;
                    addPickedRow(pendingRow, pendingSource, qty, gid);
                    setQuickAddOpen(false);
                }}
            />

            {/* Custom Element Modal */}
            <AddElementModal
                open={addElementOpen}
                onClose={() => setAddElementOpen(false)}
                groups={groupsForModals}
                onAdd={addCustomElement}
            />

            {/* Add Tax Modal */}
            <AddTaxModal
                open={addTaxOpen}
                onClose={() => setAddTaxOpen(false)}
                groups={groupsForModals}
                onAdd={addTax}
                projectTotal={projectTotal}
                groupTotals={groupTotals}
            />

            {/* Group Settings Modal */}
            <GroupSettingsModal
                open={groupSettingsOpen}
                onClose={() => setGroupSettingsOpen(false)}
                groups={groupsForModals}
                onSave={handleSaveGroupOrder}
            />
        </div>
    );
};

export default ProjectPage;