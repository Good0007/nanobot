import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.startsWith("••••")) return value;
  const last4 = value.slice(-4);
  return `••••${last4}`;
}

export function isMasked(value: string): boolean {
  return value.startsWith("••••");
}
