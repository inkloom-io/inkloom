import { IconDisplay } from "../icon-picker";

interface PreviewCardProps {
  title: string;
  icon?: string;
  href?: string;
  children?: React.ReactNode;
}

export function PreviewCard({ title, icon, href, children }: PreviewCardProps) {
  const content = (
    <div
      className="preview-card"
      data-interactive={href ? "true" : "false"}
    >
      <div className="preview-card-header">
        {icon && <IconDisplay icon={icon} className="preview-card-icon" />}
        <h3 className="preview-card-title">{title}</h3>
      </div>
      {children && <div className="preview-card-content">{children}</div>}
      {href && <span className="preview-card-arrow">→</span>}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="preview-card-link"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }

  return content;
}
