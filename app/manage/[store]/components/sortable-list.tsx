import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  Active,
  Over,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export interface Item {
  id: string | number;
  name: string;
}

type ItemButton = React.ReactElement<
  React.ButtonHTMLAttributes<HTMLButtonElement>
>;

interface SortableItemProps {
  item: Item;
  button?: ItemButton;
  onClick?: (item: Item) => void;
}

const SortableItem = ({ item, button, onClick }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex justify-between items-center gap-2 p-3 border bg-card rounded-lg cursor-default"
      onClick={!button ? () => (onClick ? onClick(item) : null) : undefined}
    >
      <div className="flex items-center gap-2">
        <GripVertical
          {...listeners}
          className="h-4 w-4 text-muted-foreground cursor-grab"
        />
        <span>{item.name}</span>
      </div>
      {button &&
        React.cloneElement(button, {
          onClick: () => (onClick ? onClick(item) : null),
        })}
    </div>
  );
};

interface SortableListProps {
  items: Item[];
  onOrderChange?: (newOrder: Item[]) => void;
  onItemClick?: (item: Item) => void;
  itemButton?: ItemButton;
}

export default function SortableList({
  items,
  itemButton,
  onOrderChange,
  onItemClick,
}: SortableListProps) {
  const [_items, setItems] = useState(items);
  const [activeId, setActiveId] = useState<string | number | null>(null);

  const handleDragStart = ({ active }: { active: Active }) => {
    setActiveId(active.id);
  };

  const handleDragEnd = ({
    active,
    over,
  }: {
    active: Active;
    over: Over | null;
  }) => {
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = _items.findIndex((item) => item.id === active.id);
    const newIndex = _items.findIndex((item) => item.id === over.id);

    const newOrder = arrayMove(_items, oldIndex, newIndex);
    setItems(newOrder);

    if (onOrderChange) {
      onOrderChange(newOrder);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={_items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {_items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              button={itemButton}
              onClick={onItemClick}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="flex justify-between items-center gap-2 p-3 border bg-card rounded-lg shadow-lg cursor-default">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grabbing" />
              <span>{_items.find((item) => item.id === activeId)?.name}</span>
            </div>
            {itemButton && React.cloneElement(itemButton)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
