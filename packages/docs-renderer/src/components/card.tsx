import { cn } from "../utils";
import { useDocsRenderer } from "../context";
import { IconDisplay } from "./icon-display";

interface CardProps {
  title: string;
  icon?: string;
  href?: string;
  children?: React.ReactNode;
}

export function Card({ title, icon, href, children }: CardProps) {
  const { LinkComponent } = useDocsRenderer();

  const content = (
    <div className={cn("card", href && "card-interactive")}>
      <div className="card-header">
        {icon && <IconDisplay icon={icon} className="card-icon" />}
        <h3 className="card-title">{title}</h3>
      </div>
      {children && <div className="card-content">{children}</div>}
      {href && <span className="card-arrow">→</span>}
    </div>
  );

  if (href) {
    return href.startsWith("http") ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      <LinkComponent href={href}>{content}</LinkComponent>
    );
  }
  return content;
}
