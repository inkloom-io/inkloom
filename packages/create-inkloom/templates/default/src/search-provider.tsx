import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchContextValue {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const SearchContext = createContext<SearchContextValue>({
  searchOpen: false,
  setSearchOpen: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SearchContext.Provider value={{ searchOpen, setSearchOpen }}>
      {children}
    </SearchContext.Provider>
  );
}
