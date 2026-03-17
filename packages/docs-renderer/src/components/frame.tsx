import { Info } from "lucide-react";

interface FrameProps {
  hint?: string;
  caption?: string;
  children?: React.ReactNode;
}

export function Frame({ hint, caption, children }: FrameProps) {
  return (
    <>
      {hint && (
        <div className="frame-hint">
          <Info className="frame-hint-icon" />
          <span>{hint}</span>
        </div>
      )}
      <figure className="frame-container">
        <div className="frame-content">{children}</div>
        {caption && (
          <figcaption className="frame-caption">{caption}</figcaption>
        )}
      </figure>
    </>
  );
}
