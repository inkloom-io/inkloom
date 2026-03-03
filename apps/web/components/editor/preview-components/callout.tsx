type CalloutType = "info" | "warning" | "danger" | "success" | "tip";

interface PreviewCalloutProps {
  type?: CalloutType;
  title?: string;
  children?: React.ReactNode;
}

const icons: Record<CalloutType, string> = {
  info: "ℹ️",
  warning: "⚠️",
  danger: "🚫",
  success: "✅",
  tip: "💡",
};

export function PreviewCallout({
  type = "info",
  title,
  children,
}: PreviewCalloutProps) {
  return (
    <div className={`preview-callout preview-callout-${type}`}>
      <div className="preview-callout-icon">{icons[type]}</div>
      <div className="preview-callout-content">
        {title && <div className="preview-callout-title">{title}</div>}
        <div className="preview-callout-body">{children}</div>
      </div>
    </div>
  );
}
