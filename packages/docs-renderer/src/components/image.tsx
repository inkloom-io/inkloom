interface ImageProps {
  src: string;
  alt?: string;
  width?: number;
}

export function Image({ src, alt = "Image", width }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className="mdx-image"
      style={width ? { width: `${width}px`, maxWidth: "100%" } : undefined}
    />
  );
}
