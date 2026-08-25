import { createContext, useContext, type ReactNode } from "react";

export type DocumentControls = {
  center?: ReactNode;
  dockedTone: ReactNode;
  leading: ReactNode;
  navHidden?: boolean;
  onMinimize: () => void;
  onStickyChange: (stuck: boolean) => void;
};

const DocumentControlsContext = createContext<DocumentControls | null>(null);

export const DocumentControlsProvider = DocumentControlsContext.Provider;

export function useDocumentControls(): DocumentControls | null {
  return useContext(DocumentControlsContext);
}
