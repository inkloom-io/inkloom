import { cn } from "../utils";

interface CardGroupProps {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}

export function CardGroup({ cols = 2, children }: CardGroupProps) {
  return (
    <div className={cn("card-group", `card-group-cols-${cols}`)}>
      {children}
    </div>
  );
}
