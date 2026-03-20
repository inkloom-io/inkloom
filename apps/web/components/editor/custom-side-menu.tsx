"use client";

import { useCallback, useRef } from "react";
import { SideMenu, useExtension } from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";

/**
 * Custom SideMenu wrapper that freezes the menu when the cursor hovers over it.
 *
 * This prevents the side menu from disappearing when the user moves their cursor
 * from a sub-content block (inside accordion, callout, steps, frame) toward the
 * side menu buttons. Without this, BlockNote's mouse-position-based hover
 * detection would detect the parent container block instead of the child block,
 * causing the menu to jump away before the user can click.
 */
export const StickyHoverSideMenu = () => {
  const sideMenuExt = useExtension(SideMenuExtension);
  const unfreezeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = useCallback(() => {
    // Clear any pending unfreeze so the menu stays frozen
    if (unfreezeTimeoutRef.current) {
      clearTimeout(unfreezeTimeoutRef.current);
      unfreezeTimeoutRef.current = undefined;
    }
    sideMenuExt.freezeMenu();
  }, [sideMenuExt]);

  const handleMouseLeave = useCallback(() => {
    // Small delay before unfreezing to prevent flicker when cursor
    // moves back to the block content area
    unfreezeTimeoutRef.current = setTimeout(() => {
      sideMenuExt.unfreezeMenu();
    }, 100);
  }, [sideMenuExt]);

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <SideMenu />
    </div>
  );
};
