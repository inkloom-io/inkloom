interface ColumnProps {
  children?: React.ReactNode;
}

export function Column({ children }: ColumnProps) {
  return (
    <div className="column">
      {children}
    </div>
  );
}
