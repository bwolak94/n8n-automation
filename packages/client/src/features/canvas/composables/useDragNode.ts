/**
 * Module-level drag state.
 * Using a plain variable (not reactive) avoids reactivity overhead and is
 * guaranteed to be set synchronously on dragstart — before any drop handler runs.
 */

interface DragNodeData {
  type: string;
  label: string;
  category: string;
}

let _current: DragNodeData | null = null;

export function setDragNode(data: DragNodeData): void {
  _current = data;
}

export function getDragNode(): DragNodeData | null {
  return _current;
}

export function clearDragNode(): void {
  _current = null;
}
