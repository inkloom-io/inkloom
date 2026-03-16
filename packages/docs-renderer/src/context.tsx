import { createContext, useContext, type ReactNode, type ComponentType } from "react";

interface LinkComponentProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}

export interface DocsRendererConfig {
  LinkComponent: ComponentType<LinkComponentProps>;
  highlightCode: (code: string, language: string) => Promise<string>;
}

const DefaultLink = ({
  href,
  children,
  className,
  target,
  rel,
}: LinkComponentProps) => (
  <a href={href} className={className} target={target} rel={rel}>
    {children}
  </a>
);

const defaultHighlightCode = async (code: string, _language: string) =>
  `<pre><code>${code}</code></pre>`;

const defaultConfig: DocsRendererConfig = {
  LinkComponent: DefaultLink,
  highlightCode: defaultHighlightCode,
};

const DocsRendererContext = createContext<DocsRendererConfig>(defaultConfig);

interface DocsRendererProviderProps extends Partial<DocsRendererConfig> {
  children: ReactNode;
}

export function DocsRendererProvider({
  children,
  LinkComponent = DefaultLink,
  highlightCode = defaultHighlightCode,
}: DocsRendererProviderProps) {
  return (
    <DocsRendererContext.Provider value={{ LinkComponent, highlightCode }}>
      {children}
    </DocsRendererContext.Provider>
  );
}

export function useDocsRenderer(): DocsRendererConfig {
  return useContext(DocsRendererContext);
}
