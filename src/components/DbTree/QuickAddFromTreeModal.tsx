// src/components/DbTree/QuickAddFromTreeModal.tsx
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

type ProjectGroup = { id: number; name: string };

type Props = {
    open: boolean;
    onClose: () => void;
    projectGroups: ProjectGroup[];
    row: any | null;
    source: "BCJ" | "WKI" | null;
    onConfirm: (quantity: number, groupId: number) => void;
};

// bezpieczna ewaluacja typu "3*3", "2,5*4"
function evaluateExpression(expr: string): number | null {
    try {
        const cleaned = expr.trim();
        if (!cleaned) return null;

        // allow only numbers/operators/parens/decimal separators/spaces
        if (!/^[0-9+\-*/().,\s]+$/.test(cleaned)) return null;

        const normalized = cleaned.replace(/,/g, ".");
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${normalized});`)();
        if (typeof result === "number" && isFinite(result)) return result;
        return null;
    } catch {
        return null;
    }
}

function toPrice(n: any): number {
    const s = String(n ?? "0").replace(/\s/g, "").replace(",", ".");
    const v = Number(s);
    return Number.isFinite(v) ? v : 0;
}

export default function QuickAddFromTreeModal({
                                                  open,
                                                  onClose,
                                                  projectGroups,
                                                  row,
                                                  source,
                                                  onConfirm,
                                              }: Props) {
    const [qty, setQty] = useState<string>("1");
    const [groupId, setGroupId] = useState<string>("0");

    const groups = useMemo(() => {
        const base = Array.isArray(projectGroups) ? projectGroups : [];
        const has0 = base.some((g) => g.id === 0);
        return has0 ? base : [{ id: 0, name: "Brak podgrupy" }, ...base];
    }, [projectGroups]);

    useEffect(() => {
        if (!open) return;
        setQty("1");
        setGroupId("0");
    }, [open]);

    const info = useMemo(() => {
        const symbol = row?.SYMBOL ?? row?.symbol ?? "";
        const opis = row?.OPIS ?? row?.opis ?? "";
        const unit = row?.JM_NAZWA ?? row?.JM ?? row?.unit ?? "szt";
        const price = toPrice(row?.CENA_SR ?? row?.cena_sr ?? row?.price ?? 0);
        return { symbol: String(symbol), opis: String(opis), unit: String(unit), price };
    }, [row]);

    const computedValue = useMemo(() => {
        const q = evaluateExpression(qty);
        const qn = q !== null && q > 0 ? q : 1;
        return Number((qn * info.price).toFixed(2));
    }, [qty, info.price]);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>Dodaj pozycję z drzewka</DialogTitle>
                    <DialogDescription>
                        Źródło: <span className="font-mono">{source ?? "—"}</span>
                    </DialogDescription>
                </DialogHeader>

                {!row ? (
                    <div className="text-sm text-muted-foreground">Brak wybranej pozycji.</div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-md border p-3 bg-muted/20">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{info.symbol}</span>
                                <span className="text-xs text-muted-foreground">({info.unit})</span>
                                <span className="text-xs text-muted-foreground">• {info.price.toFixed(2)} zł</span>
                            </div>
                            <div className="mt-1 text-sm">{info.opis}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Ilość</Label>
                                <Input
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    inputMode="decimal"
                                    placeholder='np. 3*3 albo 2,5'
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Podgrupa</Label>
                                <Select value={groupId} onValueChange={setGroupId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz podgrupę" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map((g) => (
                                            <SelectItem key={g.id} value={String(g.id)}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Wartość (wyliczana)</Label>
                            <div className="px-3 py-2 rounded-md bg-muted font-medium tabular-nums">
                                {computedValue.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Anuluj
                    </Button>
                    <Button
                        disabled={!row}
                        onClick={() => {
                            const q = evaluateExpression(qty);
                            const quantity = q !== null && q > 0 ? q : 1;
                            const gid = Number(groupId);
                            onConfirm(quantity, Number.isFinite(gid) ? gid : 0);
                        }}
                    >
                        Dodaj do kosztorysu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}