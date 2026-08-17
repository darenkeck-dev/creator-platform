import { createContext, useContext, type ReactNode } from "react";

export type DocumentControls = {
  leading: ReactNode;
  onMinimize: () => void;
  trailing: ReactNode;
};

const DocumentControlsContext = createContext<DocumentControls | null>(null);

export const DocumentControlsProvider = DocumentControlsContext.Provider;

export function useDocumentControls(): DocumentControls | null {
  return useContext(DocumentControlsContext);
}
