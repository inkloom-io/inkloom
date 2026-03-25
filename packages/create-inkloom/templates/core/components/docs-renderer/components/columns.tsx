import { cn } from "../utils";

interface ColumnsProps {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}

export function Columns({ cols = 2, children }: ColumnsProps) {
  return (
    <div className={cn("columns", `columns-cols-${cols}`)}>
      {children}
    </div>
  );
}
