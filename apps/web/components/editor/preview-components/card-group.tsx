interface PreviewCardGroupProps {
  cols?: number;
  children?: React.ReactNode;
}

export function PreviewCardGroup({ cols = 2, children }: PreviewCardGroupProps) {
  return (
    <div className="preview-card-group" data-cols={cols}>
      {children}
    </div>
  );
}
