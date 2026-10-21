import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortableEntry {
  id: string | number;
  name: string;
}

interface SortableListProps<T extends SortableEntry> {
  items: T[];
  disabled?: boolean;
  /** Persists the new order; reject to roll the list back. */
  onReorder: (items: T[]) => Promise<unknown>;
  /** Extra content for each row (thumbnail, counts, actions). */
  renderRow?: (item: T) => React.ReactNode;
}

type RowProps<T extends SortableEntry> = {
  item: T;
  disabled?: boolean;
  renderRow?: (item: T) => React.ReactNode;
};

function RowContent<T extends SortableEntry>({
  item,
  disabled,
  renderRow,
  handleProps,
}: RowProps<T> & { handleProps?: React.ButtonHTMLAttributes<HTMLButtonElement> }) {
  return (
    <>
      <button
        type="button"
        aria-label={`Reordenar ${item.name}`}
        disabled={disabled}
        className={cn(
          "flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-grab hover:bg-muted active:cursor-grabbing"
        )}
        {...handleProps}
      >
        <GripVertical className="size-4" />
      </button>
      {renderRow ? renderRow(item) : <span className="flex-1 truncate">{item.name}</span>}
    </>
  );
}

const rowClassName =
  "flex items-center gap-2 rounded-lg border bg-card p-2 pr-3 transition-shadow";

function SortableRow<T extends SortableEntry>(props: RowProps<T>) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } =
    useSortable({ id: props.item.id, disabled: props.disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(rowClassName, isDragging && "opacity-40")}
    >
      <RowContent {...props} handleProps={{ ...attributes, ...listeners }} />
    </li>
  );
}

export default function SortableList<T extends SortableEntry>({
  items,
  disabled,
  onReorder,
  renderRow,
}: SortableListProps<T>) {
  // Optimistic copy; reset whenever the server list changes.
  const [localItems, setLocalItems] = useState(items);
  const [sourceItems, setSourceItems] = useState(items);
  if (items !== sourceItems) {
    setSourceItems(items);
    setLocalItems(items);
  }
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);
    const previous = localItems;
    const next = arrayMove(localItems, oldIndex, newIndex);

    setLocalItems(next);
    try {
      await onReorder(next);
    } catch {
      setLocalItems(previous);
    }
  };

  const activeItem = localItems.find((item) => item.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }: DragStartEvent) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Pressione espaço para pegar o item, use as setas para mover e espaço novamente para soltar.",
        },
      }}
    >
      <SortableContext
        items={localItems.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <ul className="space-y-2">
          {localItems.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              disabled={disabled}
              renderRow={renderRow}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className={cn(rowClassName, "shadow-lg ring-2 ring-primary/40")}>
            <RowContent item={activeItem} renderRow={renderRow} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
