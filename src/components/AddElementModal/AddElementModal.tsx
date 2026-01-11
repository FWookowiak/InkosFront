import React, { useState } from 'react';
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

interface AddElementModalProps {
    open: boolean;
    onClose: () => void;
    groups: Group[];
    onAdd: (element: {
        name: string;
        symbol?: string;
        unit: string;
        quantity: number;
        price: number;
        value: number;
        group: number | null;
        clientId: string;
    }) => void;
}

const AddElementModal: React.FC<AddElementModalProps> = ({
    open,
    onClose,
    groups,
    onAdd,
}) => {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [unit, setUnit] = useState('szt');
    const [quantity, setQuantity] = useState<string>('1');
    const [price, setPrice] = useState<string>('0');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('0');

    const calculatedValue = () => {
        const qty = parseFloat(quantity) || 0;
        const prc = parseFloat(price) || 0;
        return (qty * prc).toFixed(2);
    };

    const handleAdd = () => {
        if (!name.trim()) {
            return;
        }

        const qty = parseFloat(quantity) || 1;
        const prc = parseFloat(price) || 0;
        const groupId = parseInt(selectedGroupId);

        // Generate unique client ID
        const clientId = typeof crypto !== 'undefined' && 'randomUUID' in crypto 
            ? crypto.randomUUID() 
            : 'id-' + Math.random().toString(36).slice(2);

        onAdd({
            name: name.trim(),
            symbol: symbol.trim() || undefined,
            unit: unit || 'szt',
            quantity: qty,
            price: prc,
            value: parseFloat(calculatedValue()),
            group: groupId === 0 ? null : groupId,
            clientId,
        });

        // Reset form
        setName('');
        setSymbol('');
        setUnit('szt');
        setQuantity('1');
        setPrice('0');
        setSelectedGroupId('0');
        onClose();
    };

    const handleCancel = () => {
        // Reset form on cancel
        setName('');
        setSymbol('');
        setUnit('szt');
        setQuantity('1');
        setPrice('0');
        setSelectedGroupId('0');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Dodaj Własny Element</DialogTitle>
                    <DialogDescription>
                        Wprowadź dane nowego elementu kosztorysu
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Name */}
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

                    {/* Symbol (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="element-symbol">Symbol / Podstawa</Label>
                        <Input
                            id="element-symbol"
                            placeholder="np. A1, B2 (opcjonalne)"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                        />
                    </div>

                    {/* Unit */}
                    <div className="space-y-2">
                        <Label htmlFor="element-unit">Jednostka</Label>
                        <Input
                            id="element-unit"
                            placeholder="np. szt, m², m³, kg"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                        />
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                        <Label htmlFor="element-quantity">Ilość</Label>
                        <Input
                            id="element-quantity"
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                        <Label htmlFor="element-price">Cena jednostkowa (zł)</Label>
                        <Input
                            id="element-price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                    </div>

                    {/* Calculated Value */}
                    <div className="space-y-2">
                        <Label>Wartość całkowita</Label>
                        <div className="px-3 py-2 bg-muted rounded-md font-medium">
                            {parseFloat(calculatedValue()).toLocaleString('pl-PL', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}{' '}
                            zł
                        </div>
                    </div>

                    {/* Group Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="element-group">Podgrupa</Label>
                        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                            <SelectTrigger id="element-group">
                                <SelectValue placeholder="Wybierz podgrupę" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id.toString()}>
                                        {group.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Anuluj
                    </Button>
                    <Button onClick={handleAdd} disabled={!name.trim()}>
                        Dodaj Element
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddElementModal;
