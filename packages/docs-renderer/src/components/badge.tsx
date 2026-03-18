interface BadgeProps {
  color?: string;
  children?: React.ReactNode;
}

export function Badge({ color = "gray", children }: BadgeProps) {
  return (
    <span className={`badge badge-${color}`}>
      {children}
    </span>
  );
}
