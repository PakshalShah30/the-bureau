"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn("relative h-6 w-11 rounded-full bg-[#c7cbd5] transition-colors data-[state=checked]:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-[#414658]", className)} {...props}>
    <SwitchPrimitive.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[23px]" />
  </SwitchPrimitive.Root>;
}
