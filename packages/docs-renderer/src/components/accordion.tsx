"use client";

import { useState, Children, isValidElement, type ReactNode } from "react";
import { IconDisplay } from "./icon-display";

interface AccordionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

interface AccordionGroupProps {
  children: ReactNode;
}

export function Accordion({ title, icon, defaultOpen = false, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`accordion ${isOpen ? "accordion-open" : ""}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {icon && <IconDisplay icon={icon} className="accordion-icon" />}
        <span className="accordion-title">{title}</span>
        <span className="accordion-chevron">&#9656;</span>
      </button>
      <div className="accordion-content">
        <div className="accordion-body">{children}</div>
      </div>
    </div>
  );
}

export function AccordionGroup({ children }: AccordionGroupProps) {
  // Pass through children - styling handles the grouping
  const accordions: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      accordions.push(child);
    }
  });

  if (accordions.length === 0) {
    return null;
  }

  return <div className="accordion-group">{accordions}</div>;
}
