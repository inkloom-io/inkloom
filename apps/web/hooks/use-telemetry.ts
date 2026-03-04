"use client";

import { createContext, useContext } from "react";
import {
  trackEvent as trackEventLib,
  isTelemetryEnabled as isTelemetryEnabledLib,
  setTelemetryEnabled as setTelemetryEnabledLib,
} from "@/lib/telemetry";

export interface TelemetryState {
  /** Whether telemetry is currently enabled. */
  enabled: boolean;
  /** Send a telemetry event (no-op if disabled). */
  trackEvent: (event: string, properties?: Record<string, unknown>) => void;
  /** Toggle telemetry opt-in/out (persisted to localStorage). */
  setEnabled: (enabled: boolean) => void;
}

/** Default state — telemetry disabled, no-op functions. */
const DEFAULT_STATE: TelemetryState = {
  enabled: false,
  trackEvent: () => {},
  setEnabled: () => {},
};

const TelemetryContext = createContext<TelemetryState>(DEFAULT_STATE);

/**
 * Access telemetry in a mode-agnostic way.
 *
 * Returns the current telemetry state and a `trackEvent` function.
 * If no TelemetryProvider is present, returns safe defaults (disabled, no-op).
 */
export function useTelemetry(): TelemetryState {
  return useContext(TelemetryContext);
}

/**
 * Create telemetry state for use in a TelemetryProvider.
 * Call this in your provider component and pass the result to TelemetryProvider.
 */
export function createTelemetryState(): TelemetryState {
  const enabled = isTelemetryEnabledLib();

  const trackEvent = (event: string, properties?: Record<string, unknown>) => {
    trackEventLib(event, properties).catch(() => {});
  };

  const setEnabled = (value: boolean) => {
    setTelemetryEnabledLib(value);
  };

  return { enabled, trackEvent, setEnabled };
}

export { TelemetryContext };
export const TelemetryProvider = TelemetryContext.Provider;
