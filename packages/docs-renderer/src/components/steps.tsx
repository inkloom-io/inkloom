"use client";

import { Children, isValidElement, type ReactNode } from "react";

interface StepProps {
  title: string;
  icon?: string;
  stepNumber?: number;
  titleSize?: "p" | "h2" | "h3";
  children: ReactNode;
}

interface StepsProps {
  children: ReactNode;
}

export function Step({ title, icon, stepNumber, titleSize = "h3", children }: StepProps) {
  const TitleTag = titleSize === "p" ? "p" : titleSize;

  return (
    <div className="step">
      <div className="step-indicator">
        {icon ? (
          <span className="step-icon">{icon}</span>
        ) : (
          <span className="step-number">{stepNumber ?? 1}</span>
        )}
        <div className="step-line" />
      </div>
      <div className="step-content">
        <TitleTag className="step-title">{title}</TitleTag>
        <div className="step-body">{children}</div>
      </div>
    </div>
  );
}

export function Steps({ children }: StepsProps) {
  // Extract step children and assign step numbers
  const steps: ReactNode[] = [];
  let stepIndex = 0;

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as StepProps;
      stepIndex++;
      // Clone the child with stepNumber if not already set
      steps.push(
        <Step
          key={stepIndex}
          title={props.title || "Step"}
          icon={props.icon}
          stepNumber={props.stepNumber ?? stepIndex}
          titleSize={props.titleSize}
        >
          {props.children}
        </Step>
      );
    }
  });

  if (steps.length === 0) {
    return null;
  }

  return <div className="steps">{steps}</div>;
}
