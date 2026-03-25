import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/components/ui/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & React.ComponentPropsWithoutRef<"div"> & { orientation?: "horizontal" | "vertical"; decorative?: boolean }
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      {...{ className: cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      ), decorative, orientation, ...props } as React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
