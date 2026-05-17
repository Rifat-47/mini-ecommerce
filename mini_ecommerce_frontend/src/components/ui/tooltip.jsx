import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

function TooltipProvider({ delay = 400, ...props }) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />
}

function Tooltip({ children, content, className, ...props }) {
  if (!content) return children
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger render={React.Children.only(children)} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner sideOffset={6}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 w-max max-w-[min(16rem,90vw)] whitespace-normal break-words rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md border border-border",
              className
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
