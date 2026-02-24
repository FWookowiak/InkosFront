// src/components/EditElementModal/EditElementModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Group = {
    id: number; // 0 = Brak podgrupy
    name: string;
    color?: string;
};

export type EditableElement = {
    _id: string;            // wewnętrzne id tabeli (zwykle clientId)
    clientId?: string;      // stabilne id do content
    id?: string | number;   // ewentualne backendowe id
    symbol?: string;
    name: string;
    unit: string;
    quantity?: number;
    price: number;
    value: number;
    group?: number | null;

    // tax
    isTax?: boolean;
    taxPercentage?: number;
    taxTarget?: number | null;

    // optional
    kind?: "custom" | "catalog" | "tax";
};

function parsePLNumber(v: string): number {
    const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

function formatPL(v: number): string {
    // do inputów – bez separatorów tysięcy, ale z kropką
    // (żeby użytkownik mógł wpisać 12,50 i to działało)
    if (!Number.isFinite(v)) return "0";
    return String(v).replace(",", ".");
}

type Props = {
    open: boolean;
    onClose: () => void;
    element: EditableElement | null;
    groups: Group[];
    onSave: (updated: EditableElement) => void;
};

export default function EditElementModal({ open, onClose, element, groups, onSave }: Props) {
    const isTax = element?.isTax === true;

    const [name, setName] = useState("");
    const [symbol, setSymbol] = useState("");
    const [unit, setUnit] = useState("szt");
    const [quantity, setQuantity] = useState("1");
    const [price, setPrice] = useState("0");
    const [groupId, setGroupId] = useState("0");

    // tax fields
    const [taxPercentage, setTaxPercentage] = useState("0");
    const [taxTarget, setTaxTarget] = useState<string>("project"); // "project" or "group:<id>"

    const groupOptions = useMemo(() => {
        const base = Array.isArray(groups) ? groups : [];
        const hasUngrouped = base.some((g) => g.id === 0);
        return hasUngrouped ? base : [{ id: 0, name: "Brak podgrupy", color: "#ffffff" }, ...base];
    }, [groups]);

    useEffect(() => {
        if (!open) return;

        const el = element;
        if (!el) return;

        setName(el.name ?? "");
        setSymbol(el.symbol ?? "");
        setUnit(el.unit ?? "szt");
        setQuantity(formatPL(el.quantity ?? 1));
        setPrice(formatPL(el.price ?? 0));

        const gid = typeof el.group === "number" ? el.group : 0;
        setGroupId(String(gid));

        setTaxPercentage(formatPL(el.taxPercentage ?? 0));

        if (el.taxTarget === null || el.taxTarget === undefined) {
            setTaxTarget("project");
        } else {
            setTaxTarget(`group:${el.taxTarget}`);
        }
    }, [open, element]);

    const computedValue = useMemo(() => {
        if (isTax) return null;
        const q = Math.max(0, parsePLNumber(quantity));
        const p = Math.max(0, parsePLNumber(price));
        return Number((q * p).toFixed(2));
    }, [quantity, price, isTax]);

    function handleSave() {
        if (!element) return;

        const trimmedName = name.trim();
        if (!trimmedName) return;

        const updated: EditableElement = { ...element };

        updated.name = trimmedName;
        updated.symbol = symbol.trim() || "";
        updated.unit = unit.trim() || "szt";

        // zawsze utrzymuj group jako number (0 = brak), a nie null
        const gid = Number(groupId);
        updated.group = Number.isFinite(gid) ? gid : 0;

        // zapewnij clientId
        updated.clientId = updated.clientId ?? updated._id;

        if (isTax) {
            const tp = Math.max(0, parsePLNumber(taxPercentage));
            updated.taxPercentage = tp;

            if (taxTarget === "project") {
                updated.taxTarget = null;
            } else if (taxTarget.startsWith("group:")) {
                const idStr = taxTarget.split(":")[1];
                const tgid = Number(idStr);
                updated.taxTarget = Number.isFinite(tgid) ? tgid : null;
            } else {
                updated.taxTarget = null;
            }

            // value zostanie przeliczony w ElementsTable przez istniejący efekt
            onSave(updated);
            onClose();
            return;
        }

        const q = Math.max(0, parsePLNumber(quantity));
        const p = Math.max(0, parsePLNumber(price));

        updated.quantity = q;
        updated.price = Number(p.toFixed(2));
        updated.value = computedValue ?? Number((q * p).toFixed(2));

        onSave(updated);
        onClose();
    }

    function handleCancel() {
        onClose();
    }

    if (!element) return null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{isTax ? "Edytuj podatek" : "Edytuj pozycję"}</DialogTitle>
                    <DialogDescription>
                        {isTax ? "Zmień parametry podatku (procent i zakres)." : "Zmień dane pozycji kosztorysu."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="ee-name">
                            Opis <span className="text-destructive">*</span>
                        </Label>
                        <Input id="ee-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>

                    {!isTax && (
                        <div className="space-y-2">
                            <Label htmlFor="ee-symbol">Podstawa / Symbol</Label>
                            <Input id="ee-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ee-unit">Jednostka</Label>
                            <Input
                                id="ee-unit"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                disabled={isTax} // zwykle podatek ma stałą jednostkę, ale możesz to odblokować jeśli chcesz
                            />
                        </div>

                        {!isTax ? (
                            <div className="space-y-2">
                                <Label htmlFor="ee-group">Podgrupa</Label>
                                <Select value={groupId} onValueChange={setGroupId}>
                                    <SelectTrigger id="ee-group">
                                        <SelectValue placeholder="Wybierz podgrupę" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupOptions.map((g) => (
                                            <SelectItem key={g.id} value={String(g.id)}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Zakres podatku</Label>
                                <Select value={taxTarget} onValueChange={setTaxTarget}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz zakres" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="project">Cały projekt</SelectItem>
                                        {groupOptions
                                            .filter((g) => g.id !== 0)
                                            .map((g) => (
                                                <SelectItem key={g.id} value={`group:${g.id}`}>
                                                    Podgrupa: {g.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {!isTax ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="ee-qty">Ilość</Label>
                                <Input
                                    id="ee-qty"
                                    inputMode="decimal"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="np. 2,5"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ee-price">Cena jednostkowa (zł)</Label>
                                <Input
                                    id="ee-price"
                                    inputMode="decimal"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="np. 12,50"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="ee-taxp">Stawka (%)</Label>
                            <Input
                                id="ee-taxp"
                                inputMode="decimal"
                                value={taxPercentage}
                                onChange={(e) => setTaxPercentage(e.target.value)}
                                placeholder="np. 8"
                            />
                        </div>
                    )}

                    {!isTax && (
                        <div className="space-y-2">
                            <Label>Wartość (wyliczana)</Label>
                            <div className="px-3 py-2 bg-muted rounded-md font-medium tabular-nums">
                                {(computedValue ?? 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Anuluj
                    </Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        Zapisz
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}