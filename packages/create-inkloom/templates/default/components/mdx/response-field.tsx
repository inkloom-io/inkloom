"use client";

import React from "react";

interface ResponseFieldProps {
  name: string;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
}

export function ResponseField({
  name,
  type,
  required,
  children,
}: ResponseFieldProps) {
  return (
    <div className="api-response-field">
      <div className="api-response-field-header">
        <code className="api-param-name">{name}</code>
        {type && <span className="api-param-type">{type}</span>}
        {required && <span className="api-param-required">required</span>}
      </div>
      {children && <div className="api-param-description">{children}</div>}
    </div>
  );
}
