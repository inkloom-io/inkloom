"use client";

import { useState, Children, isValidElement, type ReactNode } from "react";

interface TabProps {
  title: string;
  icon?: string;
  children: ReactNode;
}

interface TabsProps {
  children: ReactNode;
}

export function Tab({ children }: TabProps) {
  return <div className="tab-content">{children}</div>;
}

export function Tabs({ children }: TabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Extract tab children and their props
  const tabs: { title: string; icon?: string; content: ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as TabProps;
      tabs.push({
        title: props.title || "Tab",
        icon: props.icon,
        content: props.children,
      });
    }
  });

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tabs">
      <div className="tabs-header">
        {tabs.map((tab, index) => (
          <button
            key={index}
            type="button"
            className={`tabs-button ${index === activeIndex ? "tabs-button-active" : ""}`}
            onClick={() => setActiveIndex(index)}
          >
            {tab.icon && <span className="tabs-icon">{tab.icon}</span>}
            <span>{tab.title}</span>
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {tabs[activeIndex]?.content}
      </div>
    </div>
  );
}
