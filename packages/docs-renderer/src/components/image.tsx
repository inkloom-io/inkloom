interface ImageProps {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
}

export function Image({ src, alt = "Image", caption, width }: ImageProps) {
  const imgElement = (
    <img
      src={src}
      alt={alt}
      className="mdx-image"
      style={width ? { width: `${width}px`, maxWidth: "100%" } : undefined}
    />
  );

  if (caption) {
    return (
      <figure className="mdx-figure">
        {imgElement}
        <figcaption>{caption}</figcaption>
      </figure>
    );
  }

  return imgElement;
}
