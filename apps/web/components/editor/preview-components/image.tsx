interface PreviewImageProps {
  src: string;
  alt?: string;
  width?: number;
}

export function PreviewImage({ src, alt = "Image", width }: PreviewImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className="preview-image"
      style={width ? { width: `${width}px`, maxWidth: "100%" } : undefined}
    />
  );
}
