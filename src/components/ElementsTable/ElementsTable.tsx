// src/components/ElementsTable/ElementsTable.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, X } from "lucide-react";
import axiosInstance from "@/lib/axios";

// ⬇️ dopasuj ścieżkę importu do miejsca gdzie wrzucisz modal
import EditElementModal, { EditableElement } from "@/components/EditElementModal/EditElementModal";

type ElementRow = {
    id?: string | number;
    clientId?: string; // ✅ ważne
    symbol?: string;
    name: string;
    unit: string;
    price: number;
    value: number;
    quantity?: number;
    group?: number | null;
    kind?: "custom" | "catalog" | "tax";

    // tax
    isTax?: boolean;
    taxPercentage?: number;
    taxTarget?: number | null;
};

type Group = {
    id: number; // 0 = „Brak podgrupy”
    name: string;
    color?: string;
};

type ProjectContent = {
    version?: number;
    groups?: Group[];
    elements?: (ElementRow & { order?: number })[];
};

interface Props {
    projectId: string;
    elements: ElementRow[];
    initialGroups?: Group[];
    initialContent?: ProjectContent;
    wspregValue?: number;
}

const UNGROUPED_ID = 0;
const CONTENT_VERSION = 1;

const storageKey = (projectId: string) => `project:${projectId}:content`;

function GroupHeaderRow({
                            group,
                            isEditing,
                            editingName,
                            onStartEdit,
                            onEditChange,
                            onEditCommit,
                            onEditCancel,
                            onColor,
                            onDelete,
                        }: {
    group: Group;
    isEditing: boolean;
    editingName: string;
    onStartEdit: (g: Group) => void;
    onEditChange: (val: string) => void;
    onEditCommit: () => void;
    onEditCancel: () => void;
    onColor: (id: number, color: string) => void;
    onDelete: (id: number) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `group-${group.id}` });

    return (
        <tr
            ref={setNodeRef}
            id={`group-${group.id}`}
            className={`bg-muted/50 font-medium ${isOver ? "outline outline-2 outline-primary/60" : ""}`}
        >
            <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <input
                            autoFocus
                            className="px-2 py-1 rounded border bg-background"
                            value={editingName}
                            onChange={(e) => onEditChange(e.target.value)}
                            onBlur={onEditCommit}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onEditCommit();
                                if (e.key === "Escape") onEditCancel();
                            }}
                            aria-label="Edytuj nazwę podgrupy"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="text-left underline-offset-4 hover:underline"
                                onClick={() => onStartEdit(group)}
                                title="Kliknij, aby zmienić nazwę podgrupy"
                            >
                                {group.name}
                            </button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => onStartEdit(group)}
                                title="Edytuj nazwę podgrupy"
                                aria-label="Edytuj nazwę podgrupy"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <input
                        type="color"
                        value={group.color ?? "#ffffff"}
                        onChange={(e) => onColor(group.id, e.target.value)}
                        className="w-6 h-6 border rounded"
                        title="Kolor podgrupy"
                    />

                    {group.id !== UNGROUPED_ID && (
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onDelete(group.id)}
                            title="Usuń podgrupę"
                            aria-label="Usuń podgrupę"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </td>
            <td colSpan={6}></td>
        </tr>
    );
}

function SortableRow({
                         el,
                         groupColor,
                         onRemoveFromGroup,
                         onDelete,
                         onEdit,
                     }: {
    el: ElementRow & { _id: string };
    groupColor?: string;
    onRemoveFromGroup: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string) => void;
}) {
    const isTaxElement = el.isTax === true;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: el._id,
        disabled: isTaxElement, // tax bez drag
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: groupColor ? `${groupColor}33` : undefined,
        opacity: isDragging ? 0.65 : 1,
    };

    const isInGroup = el.group !== UNGROUPED_ID && el.group !== null && el.group !== undefined;

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`border-t hover:bg-accent/40 ${isTaxElement ? "cursor-default" : "cursor-grab active:cursor-grabbing"} select-none`}
            {...attributes}
            {...(isTaxElement ? {} : listeners)}
        >
            {/* ✅ Podstawa = symbol */}
            <td className="px-3 py-2 align-top whitespace-nowrap font-mono">
                {el.symbol?.trim() ? el.symbol : "—"}
            </td>

            <td className="px-3 py-2 align-top">
                <div className="min-w-0 overflow-hidden break-words hyphens-auto line-clamp-2">
                    {el.name}
                </div>
            </td>

            <td className="px-3 py-2 align-top whitespace-nowrap">{el.unit}</td>

            <td className="px-3 py-2 align-top text-right tabular-nums whitespace-nowrap">
                {isTaxElement ? "—" : (el.quantity ?? 1)}
            </td>

            <td className="px-3 py-2 align-top text-right tabular-nums whitespace-nowrap">
                {isTaxElement ? "—" : `${el.price.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`}
            </td>

            <td className="px-3 py-2 align-top text-right font-medium tabular-nums whitespace-nowrap">
                {el.value.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </td>

            <td className="px-3 py-2 align-top">
                <div className="flex items-center gap-1 justify-end">
                    {/* Edit */}
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(el._id);
                        }}
                        title="Edytuj"
                        aria-label="Edytuj"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>

                    {isInGroup && !isTaxElement && (
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromGroup(el._id);
                            }}
                            title="Usuń z podgrupy"
                            aria-label="Usuń z podgrupy"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(el._id);
                        }}
                        title="Usuń element"
                        aria-label="Usuń element"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </td>
        </tr>
    );
}

const ElementsTable: React.FC<Props> = ({
                                            projectId,
                                            elements,
                                            initialGroups,
                                            initialContent,
                                            wspregValue = 1.0,
                                        }) => {
    // READ localStorage (fallback)
    const saved: ProjectContent | null = useMemo(() => {
        try {
            const raw = localStorage.getItem(storageKey(projectId));
            return raw ? (JSON.parse(raw) as ProjectContent) : null;
        } catch {
            return null;
        }
    }, [projectId]);

    // ✅ API FIRST (localStorage tylko fallback)
    const [groups, setGroups] = useState<Group[]>(() => {
        const fromAPI = initialContent?.groups ?? initialGroups;
        const fromLS = saved?.groups;

        const base =
            (fromAPI && fromAPI.length) ? fromAPI :
                (fromLS && fromLS.length) ? fromLS :
                    [
                        { id: 1, name: "Podgrupa 1", color: "#fef08a" },
                        { id: 2, name: "Podgrupa 2", color: "#bfdbfe" },
                    ];

        const hasUngrouped = base.some((g) => g.id === UNGROUPED_ID);
        return hasUngrouped ? base : [{ id: UNGROUPED_ID, name: "Brak podgrupy", color: "#ffffff" }, ...base];
    });

    const mapFrom = (src?: (ElementRow & { order?: number })[], fb?: ElementRow[]) => {
        const list = (src && src.length) ? src : (fb && fb.length ? fb : []);

        return list
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((el, idx) => {
                const clientId = (el as any).clientId ?? null;

                return {
                    ...el,
                    clientId: clientId ?? undefined,
                    symbol: el.symbol ?? "",
                    quantity: el.quantity ?? 1,
                    group: typeof el.group === "number" ? el.group : UNGROUPED_ID,
                    // ✅ stabilne _id: clientId > id > fallback
                    _id: (clientId ?? el.id ?? `fallback-${projectId}-${idx}`).toString(),
                };
            });
    };

    const [items, setItems] = useState<(ElementRow & { _id: string })[]>(() => {
        const apiSrc = initialContent?.elements ?? elements;
        if (apiSrc && apiSrc.length) return mapFrom(apiSrc);
        return mapFrom(saved?.elements, []);
    });

    // WSPREG: tylko do wyświetlania, nie zmieniamy bazowych items
    const displayItems = useMemo(() => {
        return items.map((item) => {
            if (item.isTax || wspregValue === 1.0) return item;
            return {
                ...item,
                price: Number((item.price * wspregValue).toFixed(2)),
                value: Number((item.value * wspregValue).toFixed(2)),
            };
        });
    }, [items, wspregValue]);

    // Sync items z propsów (po refetch/reprice)
    const elementsLen = Array.isArray(elements) ? elements.length : -1;
    const initialElementsLen = Array.isArray(initialContent?.elements) ? (initialContent!.elements as any[]).length : -1;

    const propsElementsHash = useMemo(() => {
        const apiSrc = (initialElementsLen > 0 ? initialContent!.elements! : (elementsLen > 0 ? elements : [])) as (ElementRow & { order?: number })[];
        return JSON.stringify(
            apiSrc.map((el: any) => ({
                clientId: el.clientId ?? null,
                id: el.id ?? null,
                name: el.name,
                price: el.price,
                value: el.value,
                group: el.group ?? 0,
                isTax: el.isTax ?? false,
                taxPercentage: el.taxPercentage ?? null,
                taxTarget: el.taxTarget ?? null,
            }))
        );
    }, [initialElementsLen, elementsLen, initialContent, elements]);

    const lastPropsHashRef = useRef<string>("");

    useEffect(() => {
        const apiSrc = (initialElementsLen > 0 ? initialContent!.elements! : (elementsLen > 0 ? elements : [])) as (ElementRow & { order?: number })[];
        if (!apiSrc || apiSrc.length === 0) return;

        const shouldUpdate = apiSrc.length !== items.length || propsElementsHash !== lastPropsHashRef.current;

        if (shouldUpdate) {
            lastPropsHashRef.current = propsElementsHash;
            setItems(mapFrom(apiSrc));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, initialElementsLen, elementsLen, propsElementsHash]);

    // Sync groups z propsów
    useEffect(() => {
        const fromAPI = initialContent?.groups ?? initialGroups;
        if (fromAPI && fromAPI.length > 0) {
            const hasUngrouped = fromAPI.some((g) => g.id === UNGROUPED_ID);
            const updatedGroups = hasUngrouped ? fromAPI : [{ id: UNGROUPED_ID, name: "Brak podgrupy", color: "#ffffff" }, ...fromAPI];
            setGroups(updatedGroups);
        }
    }, [initialContent?.groups, initialGroups]);

    // --- Edycja nazwy podgrupy ---
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [editingGroupName, setEditingGroupName] = useState<string>("");

    const startEditGroup = (g: Group) => {
        setEditingGroupId(g.id);
        setEditingGroupName(g.name);
    };

    const commitEditGroup = () => {
        if (editingGroupId === null) return;
        const name = editingGroupName.trim();
        if (name.length === 0) {
            setEditingGroupId(null);
            setEditingGroupName("");
            return;
        }
        setGroups((prev) => prev.map((g) => (g.id === editingGroupId ? { ...g, name } : g)));
        setEditingGroupId(null);
        setEditingGroupName("");
    };

    const cancelEditGroup = () => {
        setEditingGroupId(null);
        setEditingGroupName("");
    };

    // WRITE: localStorage
    useEffect(() => {
        const payload: ProjectContent = {
            version: CONTENT_VERSION,
            groups,
            elements: items.map((el, order) => ({
                clientId: (el as any).clientId ?? el._id, // ✅ zapisujemy clientId
                id: el.id ?? null,
                kind: el.kind ?? (el.isTax ? "tax" : "catalog"),
                symbol: el.symbol ?? "",
                name: el.name,
                unit: el.unit,
                price: el.price,
                value: el.value,
                quantity: el.quantity ?? 1,
                group: typeof el.group === "number" ? el.group : UNGROUPED_ID,
                order,
                ...(el.isTax && {
                    isTax: el.isTax,
                    taxPercentage: el.taxPercentage,
                    taxTarget: el.taxTarget,
                }),
            })),
        };
        try {
            localStorage.setItem(storageKey(projectId), JSON.stringify(payload));
        } catch {}
    }, [projectId, groups, items]);

    // WRITE: API (debounce)
    const saveTimerRef = useRef<number | null>(null);
    const isInitialMountForSave = useRef(true);
    const lastPropsHashForSave = useRef<string>("");

    const scheduleApiSave = useCallback(() => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(async () => {
            const payload: ProjectContent = {
                version: CONTENT_VERSION,
                groups,
                elements: items.map((el, order) => ({
                    clientId: (el as any).clientId ?? el._id, // ✅
                    id: el.id ?? null,
                    kind: el.kind ?? (el.isTax ? "tax" : "catalog"),
                    symbol: el.symbol ?? "",
                    name: el.name,
                    unit: el.unit,
                    price: el.price,
                    value: el.value,
                    quantity: el.quantity ?? 1,
                    group: typeof el.group === "number" ? el.group : UNGROUPED_ID,
                    order,
                    ...(el.isTax && {
                        isTax: el.isTax,
                        taxPercentage: el.taxPercentage,
                        taxTarget: el.taxTarget,
                    }),
                })),
            };

            try {
                await axiosInstance.patch(`/api/projects/${projectId}/`, { content: payload });
            } catch (e) {
                console.error("Save content failed:", e);
            }
        }, 600);
    }, [projectId, groups, items]);

    useEffect(() => {
        if (isInitialMountForSave.current) {
            isInitialMountForSave.current = false;
            lastPropsHashForSave.current = propsElementsHash;
            return;
        }

        // jeśli przyszły zmiany z zewnątrz (np. reprice/refetch) – nie autosave
        if (lastPropsHashForSave.current !== propsElementsHash) {
            lastPropsHashForSave.current = propsElementsHash;
            return;
        }

        scheduleApiSave();
        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, [scheduleApiSave, propsElementsHash]);

    // --- TAX RECALC ---
    const lastTaxRecalcRef = useRef<string>("");

    useEffect(() => {
        const nonTaxItems = items.filter((el) => !el.isTax);
        const itemsHash = JSON.stringify(
            nonTaxItems.map((el) => ({ id: el._id, value: el.value, group: el.group }))
        );

        if (itemsHash === lastTaxRecalcRef.current) return;
        lastTaxRecalcRef.current = itemsHash;

        let needsUpdate = false;

        const updatedItems = items.map((el) => {
            if (!el.isTax || typeof el.taxPercentage !== "number") return el;

            let baseTotal = 0;

            if (el.taxTarget === null || el.taxTarget === undefined) {
                baseTotal = items.reduce((acc, item) => {
                    if (item.isTax) return acc;
                    return acc + (Number(item.value) || 0);
                }, 0);
            } else {
                baseTotal = items.reduce((acc, item) => {
                    if (item.isTax) return acc;
                    if ((item.group ?? 0) !== el.taxTarget) return acc;
                    return acc + (Number(item.value) || 0);
                }, 0);
            }

            const newValue = Number(((baseTotal * el.taxPercentage) / 100).toFixed(2));

            if (Math.abs(newValue - (Number(el.value) || 0)) > 0.01) {
                needsUpdate = true;
                return { ...el, value: newValue };
            }
            return el;
        });

        if (needsUpdate) setItems(updatedItems);
    }, [items]);

    // --- UI actions ---
    const handleAddGroup = () => {
        const existingIds = groups.map((g) => g.id);
        let newId = 1;
        while (existingIds.includes(newId)) newId++;
        setGroups((prev) => [...prev, { id: newId, name: `Podgrupa ${newId}`, color: "#e5e7eb" }]);
    };

    const handleColorChange = (id: number, color: string) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, color } : g)));
    };

    const handleDeleteGroup = (id: number) => {
        if (id === UNGROUPED_ID) return;
        setItems((prev) => prev.map((el) => (el.group === id ? { ...el, group: UNGROUPED_ID } : el)));
        setGroups((prev) => prev.filter((g) => g.id !== id));
    };

    const handleRemoveFromGroup = (elementId: string) => {
        setItems((prev) => prev.map((el) => (el._id === elementId ? { ...el, group: UNGROUPED_ID } : el)));
    };

    const handleDeleteElement = (elementId: string) => {
        setItems((prev) => prev.filter((el) => el._id !== elementId));
    };

    // --- EDIT MODAL ---
    const [editOpen, setEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const editingElement = useMemo(() => {
        if (!editingId) return null;
        const base = items.find((x) => x._id === editingId);
        return base ? (base as unknown as EditableElement) : null;
    }, [editingId, items]);

    const openEdit = (id: string) => {
        setEditingId(id);
        setEditOpen(true);
    };

    const saveEdit = (updated: EditableElement) => {
        setItems((prev) =>
            prev.map((el) => {
                if (el._id !== updated._id) return el;

                const isTax = updated.isTax === true;

                if (isTax) {
                    // tax: zostaw value, i tak przeliczy efekt
                    return {
                        ...el,
                        ...updated,
                        clientId: updated.clientId ?? el.clientId ?? el._id,
                        kind: updated.kind ?? el.kind ?? "tax",
                    } as any;
                }

                // non-tax: przelicz value na bazowych danych
                const q = Number(updated.quantity ?? el.quantity ?? 1) || 1;
                const p = Number(updated.price ?? el.price ?? 0) || 0;
                const v = Number((q * p).toFixed(2));

                return {
                    ...el,
                    ...updated,
                    clientId: updated.clientId ?? el.clientId ?? el._id,
                    kind: updated.kind ?? el.kind ?? "custom",
                    quantity: q,
                    price: Number(p.toFixed(2)),
                    value: v,
                    group: typeof updated.group === "number" ? updated.group : (el.group ?? UNGROUPED_ID),
                } as any;
            })
        );
    };

    // Drag & Drop
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        if (overId.startsWith("group-")) {
            const overGroupId = parseInt(overId.replace("group-", ""), 10);
            setItems((prev) => prev.map((el) => (el._id === activeId ? { ...el, group: overGroupId } : el)));
            return;
        }

        const activeEl = items.find((x) => x._id === activeId);
        const overEl = items.find((x) => x._id === overId);
        if (!activeEl || !overEl) return;

        if ((activeEl.group ?? UNGROUPED_ID) === (overEl.group ?? UNGROUPED_ID)) {
            const grp = activeEl.group ?? UNGROUPED_ID;
            const groupItems = items.filter((x) => (x.group ?? UNGROUPED_ID) === grp);
            const otherItems = items.filter((x) => (x.group ?? UNGROUPED_ID) !== grp);
            const oldIndex = groupItems.findIndex((x) => x._id === activeId);
            const newIndex = groupItems.findIndex((x) => x._id === overId);
            const reordered = arrayMove(groupItems, oldIndex, newIndex);
            setItems([...otherItems, ...reordered]);
        } else {
            const targetGroup = overEl.group ?? UNGROUPED_ID;
            const destGroupItems = items.filter((x) => (x.group ?? UNGROUPED_ID) === targetGroup);
            const otherItems = items.filter((x) => x._id !== activeId && (x.group ?? UNGROUPED_ID) !== targetGroup);
            const insertIndex = destGroupItems.findIndex((x) => x._id === overId);
            const movedActive = { ...activeEl, group: targetGroup };
            const newDest = [
                ...destGroupItems.slice(0, insertIndex),
                movedActive,
                ...destGroupItems.slice(insertIndex),
            ];
            setItems([...otherItems, ...newDest]);
        }
    };

    // Totals (na displayItems)
    const groupTotals = useMemo(() => {
        const map = new Map<number, number>();
        for (const el of displayItems) {
            const gid = (el.group ?? UNGROUPED_ID) as number;
            map.set(gid, (map.get(gid) ?? 0) + (Number(el.value) || 0));
        }
        return map;
    }, [displayItems]);

    const overallTotal = useMemo(
        () => displayItems.reduce((acc, el) => acc + (Number(el.value) || 0), 0),
        [displayItems]
    );

    const orderedGroups = useMemo(
        () => [groups.find((g) => g.id === UNGROUPED_ID)!, ...groups.filter((g) => g.id !== UNGROUPED_ID)],
        [groups]
    );

    return (
        <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="overflow-x-auto rounded-lg border w-full">
                    <table className="table-auto w-full border-collapse text-sm">
                        <colgroup>
                            <col className="w-[10%]" />
                            <col className="w-auto" />
                            <col className="w-[10%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            <col className="w-[12%]" />
                            <col className="w-[10%]" />
                        </colgroup>

                        <thead>
                        <tr className="bg-muted/60 text-left">
                            <th className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <span>Podstawa</span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={handleAddGroup}
                                        title="Dodaj podgrupę"
                                        aria-label="Dodaj podgrupę"
                                    >
                                        ➕
                                    </Button>
                                </div>
                            </th>
                            <th className="px-3 py-2 whitespace-nowrap">Opis</th>
                            <th className="px-3 py-2 whitespace-nowrap">Jednostka</th>
                            <th className="px-3 py-2 whitespace-nowrap">Ilość</th>
                            <th className="px-3 py-2 whitespace-nowrap">Cena</th>
                            <th className="px-3 py-2 whitespace-nowrap">Suma</th>
                            <th className="px-3 py-2 whitespace-nowrap">Akcje</th>
                        </tr>
                        </thead>

                        <tbody>
                        {orderedGroups.map((group) => {
                            const groupItems = displayItems
                                .filter((el) => (el.group ?? UNGROUPED_ID) === group.id)
                                .sort(
                                    (a, b) =>
                                        displayItems.findIndex((x) => x._id === a._id) -
                                        displayItems.findIndex((x) => x._id === b._id)
                                );

                            const subtotal = groupTotals.get(group.id) ?? 0;

                            return (
                                <React.Fragment key={group.id}>
                                    <GroupHeaderRow
                                        group={group}
                                        isEditing={editingGroupId === group.id}
                                        editingName={editingGroupName}
                                        onStartEdit={startEditGroup}
                                        onEditChange={setEditingGroupName}
                                        onEditCommit={commitEditGroup}
                                        onEditCancel={cancelEditGroup}
                                        onColor={handleColorChange}
                                        onDelete={handleDeleteGroup}
                                    />

                                    <SortableContext items={groupItems.map((x) => x._id)} strategy={verticalListSortingStrategy}>
                                        {groupItems.map((el) => (
                                            <SortableRow
                                                key={el._id}
                                                el={el}
                                                groupColor={group.color}
                                                onRemoveFromGroup={handleRemoveFromGroup}
                                                onDelete={handleDeleteElement}
                                                onEdit={openEdit}
                                            />
                                        ))}
                                    </SortableContext>

                                    <tr className="bg-muted/30">
                                        <td className="px-3 py-2 text-right font-medium" colSpan={6}>
                                            Suma podgrupy:
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                                            {subtotal.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        </tbody>

                        <tfoot>
                        <tr className="bg-muted/60">
                            <td className="px-3 py-2 text-right font-semibold" colSpan={6}>
                                Suma projektu:
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap">
                                {overallTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                            </td>
                        </tr>
                        </tfoot>
                    </table>
                </div>
            </DndContext>

            <EditElementModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                element={editingElement}
                groups={groups}
                onSave={saveEdit}
            />
        </>
    );
};

export default ElementsTable;