interface VideoProps {
  src: string;
  autoPlay?: string; // "true" | "false"
  muted?: string;
  loop?: string;
  playsInline?: string;
  controls?: string;
}

export function Video({
  src,
  autoPlay,
  muted,
  loop,
  playsInline,
  controls,
}: VideoProps) {
  return (
    <video
      className="video-block"
      src={src}
      autoPlay={autoPlay === "true"}
      muted={autoPlay === "true" ? true : muted === "true"} // browsers require muted for autoplay
      loop={loop === "true"}
      playsInline={playsInline === "true"}
      controls={controls === "true"}
    />
  );
}
