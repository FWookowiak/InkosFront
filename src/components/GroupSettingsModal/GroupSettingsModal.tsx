import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Group = {
    id: number;
    name: string;
    color?: string;
};

interface GroupSettingsModalProps {
    open: boolean;
    onClose: () => void;
    groups: Group[];
    onSave: (reorderedGroups: Group[]) => void;
}

function SortableGroupItem({ group }: { group: Group }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: group.id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border hover:bg-muted/50 transition-colors"
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
                <GripVertical className="h-5 w-5" />
            </div>
            <div
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: group.color ?? "#ffffff" }}
            />
            <span className="flex-1 font-medium">{group.name}</span>
        </div>
    );
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({ open, onClose, groups, onSave }) => {
    const [localGroups, setLocalGroups] = useState<Group[]>(groups);

    useEffect(() => {
        setLocalGroups(groups);
    }, [groups]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        setLocalGroups((items) => {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            return arrayMove(items, oldIndex, newIndex);
        });
    };

    const handleSave = () => {
        onSave(localGroups);
        onClose();
    };

    const handleCancel = () => {
        setLocalGroups(groups); // Reset to original order
        onClose();
    };

    // Filter out the "Brak podgrupy" group (id: 0) for reordering
    const reorderableGroups = localGroups.filter((g) => g.id !== 0);

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ustawienia Grup</DialogTitle>
                    <DialogDescription>
                        Przeciągnij grupy, aby zmienić ich kolejność wyświetlania
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={reorderableGroups.map((g) => g.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {reorderableGroups.map((group) => (
                                <SortableGroupItem key={group.id} group={group} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleCancel}>
                        Anuluj
                    </Button>
                    <Button onClick={handleSave}>
                        Zapisz kolejność
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GroupSettingsModal;
