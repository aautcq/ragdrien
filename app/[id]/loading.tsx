import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="h-dvh w-full flex items-center justify-center">
      <LoaderCircle size={32} className="animate-spin text-muted-foreground" />
    </div>
  )
}
