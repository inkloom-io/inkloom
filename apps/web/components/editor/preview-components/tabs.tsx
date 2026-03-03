"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";

interface PreviewTabProps {
  title: string;
  icon?: string;
  children?: ReactNode;
}

interface PreviewTabsProps {
  children?: ReactNode;
}

export function PreviewTab({ title, icon, children }: PreviewTabProps) {
  return (
    <div className="preview-tab-item">
      <div className="preview-tab-item-header">
        {icon && <span className="preview-tab-item-icon">{icon}</span>}
        <span className="preview-tab-item-title">{title}</span>
      </div>
      <div className="preview-tab-item-content">{children}</div>
    </div>
  );
}

export function PreviewTabs({ children }: PreviewTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Extract tab children and their props
  const tabs: { title: string; icon?: string; content: ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as PreviewTabProps;
      tabs.push({
        title: props.title || "Tab",
        icon: props.icon,
        content: props.children,
      });
    }
  });

  if (tabs.length === 0) {
    return <div className="preview-tabs-empty">No tabs added yet</div>;
  }

  return (
    <div className="preview-tabs">
      <div className="preview-tabs-header">
        {tabs.map((tab, index) => (
          <button
            key={index}
            type="button"
            className={`preview-tabs-button ${index === activeIndex ? "preview-tabs-button-active" : ""}`}
            onClick={() => setActiveIndex(index)}
          >
            {tab.icon && <span className="preview-tabs-icon">{tab.icon}</span>}
            <span>{tab.title}</span>
          </button>
        ))}
      </div>
      <div className="preview-tabs-content">
        {tabs[activeIndex]?.content || "Tab content"}
      </div>
    </div>
  );
}
