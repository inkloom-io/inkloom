import { ExternalLink } from "lucide-react";
import { useDocsRenderer } from "../context";

interface CustomLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
}

export function CustomLink({ href, children, ...props }: CustomLinkProps) {
  const { LinkComponent } = useDocsRenderer();

  if (!href) {
    return <span {...props}>{children}</span>;
  }

  const isExternal = href.startsWith("http") || href.startsWith("//");

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1"
        {...props}
      >
        {children}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <LinkComponent href={href} {...props}>
      {children}
    </LinkComponent>
  );
}
