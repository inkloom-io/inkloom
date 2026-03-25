"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface GroupContextValue {
  // Active tab index for each group container (by block ID)
  activeTabIndex: Record<string, number>;
  setActiveTabIndex: (containerId: string, index: number) => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupContextProvider({ children }: { children: React.ReactNode }) {
  const [activeTabIndex, setActiveTabIndexState] = useState<Record<string, number>>({});

  const setActiveTabIndex = useCallback((containerId: string, index: number) => {
    setActiveTabIndexState(prev => ({
      ...prev,
      [containerId]: index,
    }));
  }, []);

  return (
    <GroupContext.Provider value={{ activeTabIndex, setActiveTabIndex }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext() {
  return useContext(GroupContext);
}

export function useActiveTabIndex(containerId: string): [number, (index: number) => void] {
  const context = useContext(GroupContext);
  const activeIndex = context?.activeTabIndex[containerId] ?? 0;

  const setIndex = useCallback((index: number) => {
    context?.setActiveTabIndex(containerId, index);
  }, [context, containerId]);

  return [activeIndex, setIndex];
}
