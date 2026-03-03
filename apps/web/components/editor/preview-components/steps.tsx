"use client";

import { Children, isValidElement, type ReactNode } from "react";

interface PreviewStepProps {
  title: string;
  icon?: string;
  stepNumber?: number;
  children?: ReactNode;
}

interface PreviewStepsProps {
  children?: ReactNode;
}

export function PreviewStep({ title, icon, stepNumber, children }: PreviewStepProps) {
  return (
    <div className="preview-step">
      <div className="preview-step-indicator">
        {icon ? (
          <span className="preview-step-icon">{icon}</span>
        ) : (
          <span className="preview-step-number">{stepNumber ?? 1}</span>
        )}
        <div className="preview-step-line" />
      </div>
      <div className="preview-step-content">
        <h3 className="preview-step-title">{title}</h3>
        <div className="preview-step-body">{children}</div>
      </div>
    </div>
  );
}

export function PreviewSteps({ children }: PreviewStepsProps) {
  // Extract step children and assign step numbers
  const steps: ReactNode[] = [];
  let stepIndex = 0;

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as PreviewStepProps;
      stepIndex++;
      steps.push(
        <PreviewStep
          key={stepIndex}
          title={props.title || "Step"}
          icon={props.icon}
          stepNumber={props.stepNumber ?? stepIndex}
        >
          {props.children}
        </PreviewStep>
      );
    }
  });

  if (steps.length === 0) {
    return <div className="preview-steps-empty">No steps added yet</div>;
  }

  return <div className="preview-steps-container">{steps}</div>;
}
