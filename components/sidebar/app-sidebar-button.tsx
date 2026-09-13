"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"

function SidebarButton() {
  const { open } = useSidebar()
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger className="absolute top-0 left-0" />} />
      <TooltipContent>
        <p>{ open ? "Close Sidebar" : "Open Sidebar" }</p>
      </TooltipContent>
    </Tooltip>
  )
}

export { SidebarButton };
