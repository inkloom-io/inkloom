"use client";

import React from "react";

interface ParamFieldProps {
  name: string;
  type?: string;
  location?: string;
  required?: boolean;
  children?: React.ReactNode;
}

export function ParamField({
  name,
  type,
  location,
  required,
  children,
}: ParamFieldProps) {
  return (
    <div className="api-param-field">
      <div className="api-param-field-header">
        <code className="api-param-name">{name}</code>
        {type && <span className="api-param-type">{type}</span>}
        {location && (
          <span className="api-param-location">{location}</span>
        )}
        {required && <span className="api-param-required">required</span>}
      </div>
      {children && <div className="api-param-description">{children}</div>}
    </div>
  );
}
