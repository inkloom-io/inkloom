interface BadgeProps {
  color?: string;
  children?: React.ReactNode;
}

export function Badge({ color = "gray", children }: BadgeProps) {
  const isHex = color.startsWith("#");

  if (isHex) {
    const style: React.CSSProperties = {
      color: color,
      backgroundColor: `${color}18`,
      borderColor: `${color}30`,
    };
    return (
      <span className="badge" style={style}>
        {children}
      </span>
    );
  }

  return (
    <span className={`badge badge-${color}`}>
      {children}
    </span>
  );
}
