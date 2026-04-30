export const canvas = {
  addNode: "Add node",
  deleteNode: "Delete node",
  connectNodes: "Connect nodes",
  disconnectNodes: "Disconnect nodes",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitView: "Fit to view",
  undo: "Undo",
  redo: "Redo",
  selectAll: "Select all",
  copySelected: "Copy selected",
  pasteNodes: "Paste nodes",
  saveWorkflow: "Save workflow",
  runWorkflow: "Run workflow",
  workflowSaved: "Workflow saved",
  unsavedChanges: "You have unsaved changes",
  emptyCanvas: "Drag a node from the palette to get started",
} as const;

export type CanvasMessages = Record<keyof typeof canvas, string>;
