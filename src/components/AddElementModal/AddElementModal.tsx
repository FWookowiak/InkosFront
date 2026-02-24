import React, { useMemo, useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
    id: number;
    name: string;
    color?: string;
};

// ✅ element w formacie “jak reszta elementów w content”
export type ProjectElementDraft = {
    id: string;          // UUID z frontu (stabilny dla DnD/usuwania)
    symbol: string;      // zawsze string (backend-safe)
    name: string;
    unit: string;
    quantity: number;
    price: number;
    value: number;
    group: number;       // 0 = brak podgrupy (spójnie z ElementsTable)
};

interface AddElementModalProps {
    open: boolean;
    onClose: () => void;
    groups: Group[];
    onAdd: (element: ProjectElementDraft) => void;
}

function parsePLNumber(v: string): number {
    const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
    return Number((Number(n) || 0).toFixed(2));
}

function makeId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2);
}

const AddElementModal: React.FC<AddElementModalProps> = ({ open, onClose, groups, onAdd }) => {
    const [name, setName] = useState("");
    const [symbol, setSymbol] = useState("");
    const [unit, setUnit] = useState("szt");
    const [quantity, setQuantity] = useState("1");
    const [price, setPrice] = useState("0");
    const [selectedGroupId, setSelectedGroupId] = useState<string>("0");

    const groupOptions = useMemo(() => {
        const base = Array.isArray(groups) ? groups : [];
        const has0 = base.some((g) => g.id === 0);
        return has0 ? base : [{ id: 0, name: "Brak podgrupy", color: "#ffffff" }, ...base];
    }, [groups]);

    useEffect(() => {
        if (!open) return;
        setName("");
        setSymbol("");
        setUnit("szt");
        setQuantity("1");
        setPrice("0");
        setSelectedGroupId("0");
    }, [open]);

    const computed = useMemo(() => {
        const q = Math.max(0, parsePLNumber(quantity));
        const p = Math.max(0, parsePLNumber(price));
        return round2(q * p);
    }, [quantity, price]);

    const handleAdd = () => {
        const n = name.trim();
        if (!n) return;

        const q = Math.max(0, parsePLNumber(quantity)) || 1;
        const p = Math.max(0, parsePLNumber(price));
        const gid = Number(selectedGroupId);
        const groupId = Number.isFinite(gid) ? gid : 0;

        const el: ProjectElementDraft = {
            id: makeId(),
            symbol: (symbol.trim() || ""),     // ✅ zawsze string
            name: n,
            unit: (unit.trim() || "szt"),
            quantity: q,
            price: round2(p),
            value: round2(q * p),
            group: groupId,                   // ✅ 0 = brak
        };

        onAdd(el);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Wstaw własną pozycję</DialogTitle>
                    <DialogDescription>Uzupełnij dane pozycji kosztorysu.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="element-name">
                            Opis <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="element-name"
                            placeholder="np. Ściana z cegły"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="element-symbol">Podstawa / Symbol (opcjonalnie)</Label>
                        <Input
                            id="element-symbol"
                            placeholder="np. A1, KNR 2-02..."
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="element-unit">Jednostka</Label>
                            <Input
                                id="element-unit"
                                placeholder="np. szt, m², m³"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="element-group">Podgrupa</Label>
                            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger id="element-group">
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
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="element-quantity">Ilość</Label>
                            <Input
                                id="element-quantity"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="np. 2,5"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="element-price">Cena jednostkowa (zł)</Label>
                            <Input
                                id="element-price"
                                inputMode="decimal"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="np. 12,50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Wartość (wyliczana)</Label>
                        <div className="px-3 py-2 bg-muted rounded-md font-medium tabular-nums">
                            {computed.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Anuluj</Button>
                    <Button onClick={handleAdd} disabled={!name.trim()}>Dodaj</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddElementModal;