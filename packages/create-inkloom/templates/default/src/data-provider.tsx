import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

interface TabConfig {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  navigation: NavItem[];
}

interface SiteConfig {
  title: string;
  description: string;
  logo?: string;
  lightLogo?: string;
  darkLogo?: string;
  customFonts?: { heading?: string; body?: string; code?: string };
  search?: { enabled: boolean };
  proxyUrl?: string | null;
  socialLinks?: { platform: string; url: string }[];
  ctaButton?: { label: string; url: string };
  showBranding?: boolean;
}

export interface SiteData {
  config: SiteConfig;
  navigation: NavItem[];
  tabs: TabConfig[];
}

const defaultData: SiteData = {
  config: { title: "Documentation", description: "" },
  navigation: [],
  tabs: [],
};

const SiteDataContext = createContext<SiteData>(defaultData);

export function useSiteData() {
  return useContext(SiteDataContext);
}

function loadEmbeddedData(): SiteData | null {
  if (typeof document === "undefined") return null;
  try {
    const el = document.getElementById("__INKLOOM_DATA__");
    if (el?.textContent) {
      return JSON.parse(el.textContent) as SiteData;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData>(() => {
    return loadEmbeddedData() || defaultData;
  });

  useEffect(() => {
    if (!loadEmbeddedData()) {
      fetch("/_content/site.json")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json) setData(json as SiteData);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <SiteDataContext.Provider value={data}>{children}</SiteDataContext.Provider>
  );
}
