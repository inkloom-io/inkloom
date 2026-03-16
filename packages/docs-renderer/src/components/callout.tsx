import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
} from "lucide-react";
import { cn } from "../utils";

type CalloutType = "info" | "warning" | "danger" | "success" | "tip";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const icons: Record<CalloutType, React.ReactNode> = {
  info: <Info className="callout-icon" />,
  warning: <AlertTriangle className="callout-icon" />,
  danger: <AlertCircle className="callout-icon" />,
  success: <CheckCircle className="callout-icon" />,
  tip: <Lightbulb className="callout-icon" />,
};

export function Callout({ type = "info", title, children }: CalloutProps) {
  return (
    <div className={cn("callout", `callout-${type}`)}>
      <div className="shrink-0">{icons[type]}</div>
      <div className="callout-content">
        {title && <div className="callout-title">{title}</div>}
        <div className="callout-body">{children}</div>
      </div>
    </div>
  );
}
