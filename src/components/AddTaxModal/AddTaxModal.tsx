import React, { useState, useMemo } from 'react';
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

interface AddTaxModalProps {
    open: boolean;
    onClose: () => void;
    groups: Group[];
    onAdd: (taxElement: {
        name: string;
        symbol: string;
        unit: string;
        quantity: number;
        price: number;
        value: number;
        group: number | null;
        isTax: boolean;
        taxPercentage: number;
        taxTarget: number | null; // null = whole project, otherwise group id
    }) => void;
    projectTotal: number;
    groupTotals: Map<number, number>;
}

const AddTaxModal: React.FC<AddTaxModalProps> = ({
    open,
    onClose,
    groups,
    onAdd,
    projectTotal,
    groupTotals,
}) => {
    const [taxName, setTaxName] = useState('Podatek VAT');
    const [symbol, setSymbol] = useState('VAT');
    const [percentage, setPercentage] = useState<string>('23');
    const [targetType, setTargetType] = useState<'project' | 'group'>('project');
    const [targetGroupId, setTargetGroupId] = useState<string>('');

    // Filter out "Brak podgrupy" for target selection
    const selectableGroups = useMemo(() => groups.filter(g => g.id !== 0), [groups]);

    const calculatedValue = useMemo(() => {
        const percentNum = parseFloat(percentage) || 0;
        
        if (targetType === 'project') {
            return (projectTotal * percentNum) / 100;
        } else {
            const groupId = parseInt(targetGroupId);
            const groupTotal = groupTotals.get(groupId) || 0;
            return (groupTotal * percentNum) / 100;
        }
    }, [targetType, targetGroupId, percentage, projectTotal, groupTotals]);

    const handleAdd = () => {
        const percentNum = parseFloat(percentage) || 0;
        const targetGroup = targetType === 'group' ? parseInt(targetGroupId) : null;
        // Tax is placed in the same group as its target, or 0 if targeting whole project
        const placementGroup = targetGroup ?? 0;

        if (percentNum <= 0) {
            return;
        }

        if (targetType === 'group' && !targetGroup) {
            return;
        }

        onAdd({
            name: taxName || 'Podatek',
            symbol: symbol || 'VAT',
            unit: '%',
            quantity: percentNum,
            price: 0,
            value: parseFloat(calculatedValue.toFixed(2)),
            group: placementGroup,
            isTax: true,
            taxPercentage: percentNum,
            taxTarget: targetGroup,
        });

        // Reset form
        setTaxName('Podatek VAT');
        setSymbol('VAT');
        setPercentage('23');
        setTargetType('project');
        setTargetGroupId('');
        onClose();
    };

    const handleCancel = () => {
        // Reset form
        setTaxName('Podatek VAT');
        setSymbol('VAT');
        setPercentage('23');
        setTargetType('project');
        setTargetGroupId('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Dodaj Podatek</DialogTitle>
                    <DialogDescription>
                        Dodaj podatek procentowy do projektu lub wybranej grupy. Podatek zostanie automatycznie umieszczony w tej samej grupie co jego cel.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="taxName">Nazwa podatku</Label>
                        <Input
                            id="taxName"
                            value={taxName}
                            onChange={(e) => setTaxName(e.target.value)}
                            placeholder="np. Podatek VAT"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="symbol">Symbol</Label>
                        <Input
                            id="symbol"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            placeholder="np. VAT, PTU"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="percentage">Procent (%)</Label>
                        <Input
                            id="percentage"
                            type="number"
                            min="0"
                            step="0.01"
                            value={percentage}
                            onChange={(e) => setPercentage(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="targetType">Zastosuj do</Label>
                        <Select value={targetType} onValueChange={(v) => setTargetType(v as 'project' | 'group')}>
                            <SelectTrigger id="targetType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="project">Cały projekt</SelectItem>
                                <SelectItem value="group">Konkretna grupa</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {targetType === 'group' && (
                        <div className="space-y-2">
                            <Label htmlFor="targetGroup">Wybierz grupę docelową</Label>
                            <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                                <SelectTrigger id="targetGroup">
                                    <SelectValue placeholder="Wybierz grupę" />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectableGroups.map((group) => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Podatek zostanie umieszczony w tej samej grupie
                            </p>
                        </div>
                    )}

                    <div className="p-4 bg-muted rounded-md">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Obliczona wartość:</span>
                            <span className="text-lg font-bold text-primary">
                                {calculatedValue.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })} zł
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Anuluj
                    </Button>
                    <Button 
                        onClick={handleAdd}
                        disabled={targetType === 'group' && !targetGroupId}
                    >
                        Dodaj podatek
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddTaxModal;
