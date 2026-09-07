import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getHostname(url?: string): string {
  if (!url) {
    return ""
  }
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}
