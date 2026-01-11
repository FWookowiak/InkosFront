// src/pages/ProjectPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../lib/axios';
import ElementsTable from '@/components/ElementsTable/ElementsTable';
import DbTree from '@/components/DbTree/DbTree';
import AddPositionModal from '@/components/DbTree/AddPositionModal';
import GroupSettingsModal from '@/components/GroupSettingsModal/GroupSettingsModal';
import AddElementModal from '@/components/AddElementModal/AddElementModal';
import AddTaxModal from '@/components/AddTaxModal/AddTaxModal';
import { toast } from 'sonner';
import { useProjectSummary } from '@/contexts/ProjectSummaryContext';
import { useProjectData } from '@/hooks/useProjectData';

const ProjectPage = () => {
    const projectId = window.location.pathname.split('/').pop() as string;
    const { data, loading, elements: apiElements, groups: apiGroups, content, refetch } = useProjectData(projectId);
    const { setSummaryData, setRefetchProject, groupSettingsOpenTrigger, addElementOpenTrigger, addTaxOpenTrigger } = useProjectSummary();

    const [sidebarWidth, setSidebarWidth] = useState(300);
    const resizerRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef(false);

    // wymuszenie remountu ElementsTable po dodaniu – gdyby komponent trzymał własny stan
    const [tableVersion, setTableVersion] = useState(0);

    const [addOpen, setAddOpen] = useState(false);
    const [addElementOpen, setAddElementOpen] = useState(false);
    const [addTaxOpen, setAddTaxOpen] = useState(false);
    const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

    // Provide refetch function to context
    useEffect(() => {
        setRefetchProject(() => () => refetch());
        return () => setRefetchProject(null);
    }, [refetch, setRefetchProject]);

    // Update summary data when project data changes
    useEffect(() => {
        if (data) {
            const total = apiElements.reduce((sum: number, el: any) => {
                const value = Number(el.value) || 0;
                return sum + value;
            }, 0);

            setSummaryData({
                total,
                itemsCount: apiElements.length,
                groupsCount: apiGroups.filter((g: any) => g.id !== 0).length, // Exclude "Brak podgrupy"
                projectId,
                projectName: data.name,
                sekocenbud_catalog: data.sekocenbud_catalog,
                wspreg_name: data.wspreg_name,
                wspreg_value: data.wspreg_value,
            });
        } else {
            setSummaryData(null);
        }
    }, [data, apiElements, apiGroups, projectId, setSummaryData]);

    // Listen for group settings trigger from Topbar
    useEffect(() => {
        if (groupSettingsOpenTrigger > 0) {
            setGroupSettingsOpen(true);
        }
    }, [groupSettingsOpenTrigger]);

    // Listen for add element trigger from Topbar
    useEffect(() => {
        if (addElementOpenTrigger > 0) {
            setAddElementOpen(true);
        }
    }, [addElementOpenTrigger]);

    // Listen for add tax trigger from Topbar
    useEffect(() => {
        if (addTaxOpenTrigger > 0) {
            setAddTaxOpen(true);
        }
    }, [addTaxOpenTrigger]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < window.innerWidth - 200) {
                setSidebarWidth(newWidth);
            }
        };
        const handleMouseUp = () => { isResizingRef.current = false; };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startResizing = () => { isResizingRef.current = true; };

    // helper do UUID
    function makeId() {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
        return 'id-' + Math.random().toString(36).slice(2);
    }

    // mapowanie wiersza BCJ/WKI -> element do tabeli projektu (uwzględnia ilość)
    function mapRowToElement(row: any, quantity: number, groupId: number) {
        const symbol = row.SYMBOL ?? row.symbol ?? '';
        const opis = row.OPIS ?? row.opis ?? '';
        const jm = row.JM_NAZWA ?? row.JM ?? 'szt';
        const priceNum = Number((row.CENA_SR ?? row.cena_sr ?? 0).toString().replace(',', '.')) || 0;
        const qty = Number(quantity) || 1;

        return {
            clientId: makeId(),
            name: String(opis),
            symbol: String(symbol),
            unit: String(jm),
            price: priceNum,
            quantity: qty,
            value: Number((priceNum * qty).toFixed(2)),
            group: groupId === 0 ? null : groupId, // ✅ TU
        };
    }

    // callback z modala: dodaj wybraną pozycję do projektu i zapisz
    async function addPickedRow(row: any, _source: 'BCJ' | 'WKI', quantity: number, groupId: number) {
        console.log("[addPickedRow] groupId =", groupId, "quantity =", quantity, "row.SYMBOL =", row?.SYMBOL ?? row?.symbol);
        try {
            const newEl = mapRowToElement(row, quantity, groupId);
            console.log("[addPickedRow] newEl.group =", newEl.group, "newEl =", newEl);


            // zbuduj nową listę elementów w oparciu o to co faktycznie mamy
            const current = Array.isArray(apiElements) ? apiElements : [];
            const newElements = [...current, newEl];

            const newContent = {
                ...(content || {}),
                elements: newElements,
                groups: Array.isArray(apiGroups) ? apiGroups : [],
            };

            // 1) Wyślij PATCH do backendu
            console.log("[addPickedRow] PATCH payload last element =", newContent.elements?.[newContent.elements.length - 1]);
            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            // 2) Po zapisie – odczytaj świeże dane projektu (najpewniejsze)
            await refetch();
            console.log("[addPickedRow] refetch done ✅");

            // 3) Wymuś remount tabeli (na wypadek, gdy ElementsTable cache'uje coś wewnętrznie)
            setTableVersion(v => v + 1);

            toast.success('Pozycja dodana do kosztorysu');
            setAddOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Nie udało się dodać pozycji');
        }
    }

    // Handler for adding custom element
    async function addCustomElement(element: {
        name: string;
        symbol?: string;
        unit: string;
        quantity: number;
        price: number;
        value: number;
        group: number | null;
        clientId: string;
    }) {
        try {
            const current = Array.isArray(apiElements) ? apiElements : [];
            const newElements = [...current, element];

            const newContent = {
                ...(content || {}),
                elements: newElements,
                groups: Array.isArray(apiGroups) ? apiGroups : [],
            };

            // Save to backend
            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            // Refresh project data
            await refetch();

            // Force table remount
            setTableVersion(v => v + 1);

            toast.success('Element dodany pomyślnie');
        } catch (e) {
            console.error(e);
            toast.error('Nie udało się dodać elementu');
        }
    }

    // Handler for adding tax
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
            const current = Array.isArray(apiElements) ? apiElements : [];
            const newElements = [...current, taxElement];

            const newContent = {
                ...(content || {}),
                elements: newElements,
                groups: Array.isArray(apiGroups) ? apiGroups : [],
            };

            // Save to backend
            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });

            // Refresh project data
            await refetch();

            // Force table remount
            setTableVersion(v => v + 1);

            toast.success('Podatek dodany pomyślnie');
        } catch (e) {
            console.error(e);
            toast.error('Nie udało się dodać podatku');
        }
    }

    // Save reordered groups
    const handleSaveGroupOrder = async (reorderedGroups: any[]) => {
        try {
            // Find "Brak podgrupy" group (id: 0)
            const ungroupedGroup = apiGroups.find((g: any) => g.id === 0);
            
            // Filter out any potential duplicates with id=0 from reordered groups
            const filteredReorderedGroups = reorderedGroups.filter((g: any) => g.id !== 0);
            
            // Reconstruct groups array with ungrouped first, then reordered
            const finalGroups = ungroupedGroup 
                ? [ungroupedGroup, ...filteredReorderedGroups]
                : filteredReorderedGroups;

            const newContent = {
                ...(content || {}),
                elements: Array.isArray(apiElements) ? apiElements : [],
                groups: finalGroups,
            };

            await axiosInstance.patch(`/api/projects/${projectId}/`, { content: newContent });
            await refetch();
            setTableVersion(v => v + 1);
            
            toast.success('Kolejność grup została zapisana');
        } catch (e) {
            console.error(e);
            toast.error('Nie udało się zapisać kolejności grup');
        }
    };

    // Calculate group totals (excluding taxes for correct base calculation)
    const calculateGroupTotals = () => {
        const map = new Map<number, number>();
        const elements = Array.isArray(apiElements) ? apiElements : [];
        
        for (const el of elements) {
            // Skip tax elements when calculating base totals
            if (el.isTax) continue;
            
            const gid = (el.group ?? 0) as number;
            map.set(gid, (map.get(gid) ?? 0) + (Number(el.value) || 0));
        }
        return map;
    };

    // Calculate project total (excluding taxes)
    const calculateProjectTotal = () => {
        const elements = Array.isArray(apiElements) ? apiElements : [];
        return elements.reduce((acc, el) => {
            // Skip tax elements when calculating base total
            if (el.isTax) return acc;
            return acc + (Number(el.value) || 0);
        }, 0);
    };

    const groupTotals = calculateGroupTotals();
    const projectTotal = calculateProjectTotal();

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-background to-muted/20 pt-24">
            <div className="flex h-full">
                {/* LEWA KOLUMNA: drzewo BCJ/WKI (2024) */}
                <aside
                    className="bg-white shadow p-4 overflow-auto"
                    style={{ width: sidebarWidth, minWidth: 200 }}
                >
                    <DbTree />
                </aside>

                {/* Uchwyt do zmiany szerokości */}
                <div
                    ref={resizerRef}
                    onMouseDown={startResizing}
                    className="cursor-col-resize bg-gray-300 hover:bg-gray-400 transition-colors"
                    style={{ width: 6 }}
                />

                {/* PRAWA KOLUMNA: tabela elementów projektu */}
                <main className="flex-1 p-4 pt-6">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{data?.name || 'Projekt'}</h2>
                        <button
                            className="px-3 py-1.5 rounded bg-emerald-600 text-white"
                            onClick={() => setAddOpen(true)}
                        >
                            Dodaj pozycję
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-muted-foreground">Loading table...</p>
                    ) : (
                        <ElementsTable
                            key={`et-${projectId}-${tableVersion}`}  // remount przy każdej zmianie
                            projectId={projectId}
                            elements={apiElements}
                            initialGroups={apiGroups}
                            initialContent={content}
                            wspregValue={data?.wspreg_value ?? 1.0}
                        />
                    )}
                </main>
            </div>

            {/* Modal dodawania pozycji (NORMA-like) */}
            <AddPositionModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                projectGroups={apiGroups}
                onPick={addPickedRow}
            />

            {/* Custom Element Modal */}
            <AddElementModal
                open={addElementOpen}
                onClose={() => setAddElementOpen(false)}
                groups={apiGroups}
                onAdd={addCustomElement}
            />

            {/* Add Tax Modal */}
            <AddTaxModal
                open={addTaxOpen}
                onClose={() => setAddTaxOpen(false)}
                groups={apiGroups}
                onAdd={addTax}
                projectTotal={projectTotal}
                groupTotals={groupTotals}
            />

            {/* Group Settings Modal */}
            <GroupSettingsModal
                open={groupSettingsOpen}
                onClose={() => setGroupSettingsOpen(false)}
                groups={apiGroups}
                onSave={handleSaveGroupOrder}
            />
        </div>
    );
};

export default ProjectPage;
