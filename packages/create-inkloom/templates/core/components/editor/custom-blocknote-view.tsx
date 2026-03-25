"use client";

/**
 * Custom BlockNoteView wrapper that fixes the Popover portal issue.
 *
 * The default @blocknote/mantine Popover uses `withinPortal={false}`, which causes
 * the link creation popover to be clipped by parent containers with `overflow: hidden`.
 *
 * This wrapper provides a custom components object that uses `withinPortal={true}`
 * for the Popover, ensuring it renders in a portal that escapes overflow containers.
 */

import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { mergeCSSClasses } from "@blocknote/core";
import {
  BlockNoteViewRaw,
  ComponentsContext,
  useBlockNoteContext,
} from "@blocknote/react";
import { useTheme } from "next-themes";
import {
  MantineContext,
  MantineProvider,
  Popover as MantinePopover,
  PopoverDropdown as MantinePopoverDropdown,
  PopoverTarget as MantinePopoverTarget,
  Menu as MantineMenu,
  Button as MantineButton,
  CheckIcon as MantineCheckIcon,
} from "@mantine/core";
import { HiChevronDown } from "react-icons/hi";
import React, { useCallback, useContext, useMemo, forwardRef, useEffect } from "react";

// Import the default components and theme utilities from @blocknote/mantine
import type { Theme } from "@blocknote/mantine";
import {
  components as defaultComponents,
  applyBlockNoteCSSVariablesFromTheme,
  removeBlockNoteCSSVariables,
} from "@blocknote/mantine";

// Custom Popover components that use withinPortal={true}
//
// PROBLEM: BlockNote's CreateLinkButton has a useEffect that sets showPopover(false)
// whenever the editor state changes. When clicking the button:
// 1. onClick sets showPopover(true)
// 2. The click also triggers a state change in the editor
// 3. The useEffect fires and sets showPopover(false)
// 4. With React 18 batching, both updates can process together, so open may never be true
//
// SOLUTION: We use a global event to track when a popover trigger is clicked.
// When clicked, we force the popover open regardless of the `open` prop.

// Global ref to track when any popover trigger was last clicked
const globalTriggerClickTimeRef = { current: 0 };

const CustomPopover = (props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  position?: string;
  children?: React.ReactNode;
}) => {
  const { open, onOpenChange, position, children } = props;

  // Internal open state that we control
  const [internalOpen, setInternalOpen] = React.useState(false);

  // Check on every render if we should be force-open due to a recent trigger click
  const timeSinceTriggerClick = Date.now() - globalTriggerClickTimeRef.current;
  const shouldForceOpen = timeSinceTriggerClick < 300;

  // Sync internal state with open prop, but respect force-open
  useEffect(() => {
    if (open) {
      setInternalOpen(true);
    } else {
      // Only close if we're not in the force-open window
      if (!shouldForceOpen) {
        setInternalOpen(false);
      }
      // If we ARE in force-open window, schedule a check for when window expires
      else {
        const remainingTime = 300 - timeSinceTriggerClick;
        const timer = setTimeout(() => {
          // Re-check the open prop after the window expires
          // The next render will handle it properly
        }, remainingTime + 50);
        return () => clearTimeout(timer);
      }
    }
  }, [open, shouldForceOpen, timeSinceTriggerClick]);

  // Handle changes from Mantine (e.g., click outside, escape key)
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // User wants to close - always allow
      setInternalOpen(false);
    }
    onOpenChange?.(newOpen);
  }, [onOpenChange]);

  // Compute final open state: open if internal says open OR if force-open is active
  const finalOpen = internalOpen || shouldForceOpen;

  return (
    <MantinePopover
      middlewares={{ size: { padding: 20 } }}
      withinPortal={true}
      portalProps={{ target: document.body }}
      opened={finalOpen}
      onChange={handleOpenChange}
      position={position as "top" | "bottom" | "left" | "right" | undefined}
      zIndex={10000}
      shadow="md"
    >
      {children}
    </MantinePopover>
  );
};

const CustomPopoverTrigger = (props: { children?: React.ReactNode }) => {
  const { children } = props;

  // Record click time when trigger is clicked
  // Use mousedown for more reliable timing (fires before click)
  const handleInteraction = useCallback(() => {
    globalTriggerClickTimeRef.current = Date.now();
  }, []);

  // Clone the child to add our click handler without breaking MantinePopoverTarget's ref
  const enhancedChildren = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ onMouseDown?: React.MouseEventHandler; onClick?: React.MouseEventHandler }>, {
        onMouseDown: (e: React.MouseEvent) => {
          handleInteraction();
          // Call the original handler if it exists
          const original = (children as React.ReactElement<{ onMouseDown?: React.MouseEventHandler }>).props.onMouseDown;
          if (original) original(e);
        },
        onClick: (e: React.MouseEvent) => {
          handleInteraction();
          // Call the original handler if it exists
          const original = (children as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick;
          if (original) original(e);
        },
      })
    : children;

  return <MantinePopoverTarget>{enhancedChildren}</MantinePopoverTarget>;
};

const CustomPopoverContent = forwardRef<
  HTMLDivElement,
  { className?: string; variant?: string; children?: React.ReactNode }
>((props, ref) => {
  const { className, children } = props;
  return (
    <MantinePopoverDropdown className={className} ref={ref}>
      {children}
    </MantinePopoverDropdown>
  );
});

CustomPopoverContent.displayName = "CustomPopoverContent";

// Custom Toolbar that replaces the default Mantine Toolbar to remove
// useFocusTrap, which causes toolbar buttons to require two clicks.
const CustomToolbar = forwardRef<
  HTMLDivElement,
  {
    className?: string;
    children?: React.ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    variant?: "default" | "action-toolbar";
  }
>((props, ref) => {
  const { className, children, onMouseEnter, onMouseLeave, variant } = props;

  return (
    <div
      className={className}
      ref={ref}
      role="toolbar"
      onPointerDown={(e) => {
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ display: "flex", gap: variant === "action-toolbar" ? 2 : undefined }}
    >
      {children}
    </div>
  );
});

CustomToolbar.displayName = "CustomToolbar";

// Custom Menu root that disables trapFocus.
const CustomMenuRoot = (props: {
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  position?: string;
  sub?: boolean;
}) => {
  const { children, onOpenChange, position, sub } = props;

  if (sub) {
    return (
      <MantineMenu.Sub
        transitionProps={{ duration: 250, exitDelay: 250 }}
        withinPortal={false}
        middlewares={{ flip: true, shift: true, inline: false, size: true }}
        onChange={onOpenChange}
        position={position as "left" | "right" | undefined}
      >
        {children}
      </MantineMenu.Sub>
    );
  }

  return (
    <MantineMenu
      withinPortal={false}
      middlewares={{ flip: true, shift: true, inline: false, size: true }}
      onChange={onOpenChange}
      position={position as "top" | "bottom" | "left" | "right" | undefined}
      returnFocus={false}
      trapFocus={false}
    >
      {children}
    </MantineMenu>
  );
};

// Custom ToolbarSelect that disables trapFocus on the internal Menu.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomToolbarSelect = forwardRef<HTMLDivElement, any>((props, ref) => {
  const { className, items, isDisabled } = props;

  const selectedItem = items?.filter((p: { isSelected: boolean }) => p.isSelected)[0];

  if (!selectedItem) {
    return null;
  }

  return (
    <MantineMenu
      withinPortal={false}
      transitionProps={{ exitDuration: 0 }}
      disabled={isDisabled}
      middlewares={{ flip: true, shift: true, inline: false, size: true }}
      trapFocus={false}
      returnFocus={false}
    >
      <MantineMenu.Target>
        <MantineButton
          leftSection={selectedItem.icon}
          rightSection={<HiChevronDown />}
          size="xs"
          variant="subtle"
          disabled={isDisabled}
        >
          {selectedItem.text}
        </MantineButton>
      </MantineMenu.Target>
      <MantineMenu.Dropdown className={className} ref={ref}>
        {items.map((item: { text: string; icon?: React.ReactNode; onClick?: () => void; isSelected: boolean; isDisabled?: boolean }) => (
          <MantineMenu.Item
            key={item.text}
            onClick={item.onClick}
            leftSection={item.icon}
            rightSection={
              item.isSelected ? (
                <MantineCheckIcon size={10} className="bn-tick-icon" />
              ) : (
                <div className="bn-tick-space" />
              )
            }
            disabled={item.isDisabled}
          >
            {item.text}
          </MantineMenu.Item>
        ))}
      </MantineMenu.Dropdown>
    </MantineMenu>
  );
});

CustomToolbarSelect.displayName = "CustomToolbarSelect";

export const BlockNoteView = <
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>(
  props: Omit<
    React.ComponentProps<typeof BlockNoteViewRaw<BSchema, ISchema, SSchema>>,
    "theme"
  > & {
    theme?:
      | "light"
      | "dark"
      | Theme
      | {
          light: Theme;
          dark: Theme;
        };
  },
) => {
  const { className, theme, ...rest } = props;

  const existingContext = useBlockNoteContext();
  const { resolvedTheme } = useTheme();
  const defaultColorScheme =
    existingContext?.colorSchemePreference || (resolvedTheme === "dark" ? "dark" : "light");

  // Create modified components with our custom Popover, Toolbar, and Menu.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customComponents = useMemo(() => ({
    ...defaultComponents,
    FormattingToolbar: {
      ...defaultComponents.FormattingToolbar,
      Root: CustomToolbar,
      Select: CustomToolbarSelect,
    },
    LinkToolbar: {
      ...defaultComponents.LinkToolbar,
      Root: CustomToolbar,
      Select: CustomToolbarSelect,
    },
    Generic: {
      ...defaultComponents.Generic,
      Popover: {
        Root: CustomPopover,
        Trigger: CustomPopoverTrigger,
        Content: CustomPopoverContent,
      },
      Menu: {
        ...defaultComponents.Generic.Menu,
        Root: CustomMenuRoot,
      },
      Toolbar: {
        ...defaultComponents.Generic.Toolbar,
        Root: CustomToolbar,
        Select: CustomToolbarSelect,
      },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      removeBlockNoteCSSVariables(node);

      if (typeof theme === "object") {
        if ("light" in theme && "dark" in theme) {
          applyBlockNoteCSSVariablesFromTheme(
            theme[defaultColorScheme === "dark" ? "dark" : "light"],
            node,
          );
          return;
        }

        applyBlockNoteCSSVariablesFromTheme(theme, node);
        return;
      }
    },
    [defaultColorScheme, theme],
  );

  const mantineContext = useContext(MantineContext);

  const finalTheme =
    typeof theme === "string"
      ? theme
      : defaultColorScheme;

  const view = (
    <ComponentsContext.Provider value={customComponents}>
      <BlockNoteViewRaw
        data-mantine-color-scheme={finalTheme}
        className={mergeCSSClasses("bn-mantine", className || "")}
        theme={typeof theme === "object" ? undefined : theme}
        {...rest}
        ref={ref}
      />
    </ComponentsContext.Provider>
  );

  if (mantineContext) {
    return view;
  }

  return (
    <MantineProvider
      withCssVariables={false}
      getRootElement={() => undefined}
    >
      {view}
    </MantineProvider>
  );
};
