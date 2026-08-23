import { createContext, useContext, type ReactNode } from "react";

export type DocumentControls = {
  busy?: boolean;
  center?: ReactNode;
  compactBreadcrumbs?: boolean;
  leading: ReactNode;
  onMinimize: () => void;
  onStickyChange?: (stuck: boolean) => void;
  trailing: ReactNode;
};

const DocumentControlsContext = createContext<DocumentControls | null>(null);

export const DocumentControlsProvider = DocumentControlsContext.Provider;

export function useDocumentControls(): DocumentControls | null {
  return useContext(DocumentControlsContext);
}
