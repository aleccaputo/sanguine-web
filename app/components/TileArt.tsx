import { useState } from 'react';

/**
 * Ghosted boss/activity artwork behind a tile-race task tile, shared by the
 * public board and the admin board builder. Sits under the tile text at low
 * opacity, and unmounts itself if the keyword-guessed wiki image 404s so a
 * broken-image glyph never shows.
 */
export function TileArt({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className="pointer-events-none absolute inset-0 m-auto max-h-[70%] max-w-[75%] object-contain opacity-35"
    />
  );
}
