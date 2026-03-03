"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";

interface PreviewAccordionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

interface PreviewAccordionGroupProps {
  children?: ReactNode;
}

export function PreviewAccordion({ title, icon, defaultOpen = false, children }: PreviewAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`preview-accordion ${isOpen ? "preview-accordion-open" : ""}`}>
      <button
        type="button"
        className="preview-accordion-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {icon && <span className="preview-accordion-icon">{icon}</span>}
        <span className="preview-accordion-title">{title}</span>
        <span className="preview-accordion-chevron">&#9656;</span>
      </button>
      <div className="preview-accordion-content">
        <div className="preview-accordion-body">{children}</div>
      </div>
    </div>
  );
}

export function PreviewAccordionGroup({ children }: PreviewAccordionGroupProps) {
  // Pass through children - styling handles the grouping
  const accordions: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      accordions.push(child);
    }
  });

  if (accordions.length === 0) {
    return <div className="preview-accordion-group-empty">No accordions added yet</div>;
  }

  return <div className="preview-accordion-group">{accordions}</div>;
}
