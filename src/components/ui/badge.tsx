import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants with subtle pastels
        success:
          "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        warning:
          "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100",
        error:
          "border-transparent bg-red-50 text-red-700 hover:bg-red-100",
        info:
          "border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100",
        draft:
          "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
        running:
          "border-transparent bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
        completed:
          "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        failed:
          "border-transparent bg-red-50 text-red-700 hover:bg-red-100",
        partial:
          "border-transparent bg-orange-50 text-orange-700 hover:bg-orange-100",
        pending:
          "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
        // Org type variants
        production:
          "border-transparent bg-purple-50 text-purple-700 hover:bg-purple-100",
        sandbox:
          "border-transparent bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
