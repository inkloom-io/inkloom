import React, { useState } from "react";

interface ExpandableProps {
  title: string;
  type?: string;
  children?: React.ReactNode;
}

export function Expandable({ title, type, children }: ExpandableProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`api-expandable ${open ? "api-expandable-open" : ""}`}>
      <button
        className="api-expandable-header"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="api-expandable-chevron">{open ? "\u25BC" : "\u25B6"}</span>
        <code className="api-param-name">{title}</code>
        {type && <span className="api-param-type">{type}</span>}
      </button>
      {open && <div className="api-expandable-content">{children}</div>}
    </div>
  );
}
