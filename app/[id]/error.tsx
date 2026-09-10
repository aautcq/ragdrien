"use client";

import { AlertCircleIcon } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export function AlertDestructive() {
  return (
    <Alert variant="destructive" className="max-w-md">
      <AlertCircleIcon />
      <AlertTitle>Oops!</AlertTitle>
      <AlertDescription>
        Something went wrong.
      </AlertDescription>
    </Alert>
  )
}


export default function Error() {
  return (
    <div className="h-dvh w-full flex items-center justify-center">
      <AlertDestructive />
    </div>
  )
}
