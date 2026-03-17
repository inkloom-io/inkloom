interface IFrameProps {
  src: string;
  title?: string;
  width?: string;
  height?: string;
  allow?: string;
  allowFullScreen?: string;
}

export function IFrame({
  src,
  title,
  width,
  height,
  allow,
  allowFullScreen,
}: IFrameProps) {
  return (
    <iframe
      className="iframe-block"
      src={src}
      title={title || undefined}
      width={width || undefined}
      height={height || undefined}
      allow={allow || undefined}
      allowFullScreen={allowFullScreen === "true"}
      style={{ border: "none" }}
    />
  );
}
