import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

interface StatusBadgeProps {
  running: boolean;
  error?: string | null;
  className?: string;
}

export function StatusBadge({ running, error, className }: StatusBadgeProps) {
  if (error) {
    return (
      <Badge variant="destructive" className={cn(className)}>
        Error
      </Badge>
    );
  }
  return (
    <Badge
      variant={running ? "default" : "secondary"}
      className={cn(
        running ? "bg-green-500 hover:bg-green-600 text-white" : "",
        className
      )}
    >
      {running ? "Running" : "Stopped"}
    </Badge>
  );
}
