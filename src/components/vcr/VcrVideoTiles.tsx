import React from 'react';
import { VideoOff } from 'lucide-react';
import type { RemoteVideo } from '@/hooks/useVcrCall';
import { cn } from '@/lib/utils';

interface Props {
  localStream: MediaStream | null;
  localName: string;
  remotes: RemoteVideo[];
  /** Keep my own tile on screen even when my camera is off. */
  alwaysShowSelf?: boolean;
}


function Tile({ stream, name, muted, mirrored }: { stream: MediaStream; name: string; muted?: boolean; mirrored?: boolean }) {
  const ref = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-vcr-chrome/20 bg-black/50">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn('aspect-video w-full object-cover', mirrored && 'scale-x-[-1]')}
      />
      <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-vcr-chrome/90">
        {name}
      </span>
    </div>
  );
}

/**
 * Live camera tiles for the in-app class call. Purely presentational —
 * the audio path and every other VCR feature stay exactly as they were.
 */
export function VcrVideoTiles({ localStream, localName, remotes, alwaysShowSelf = false }: Props) {
  if (!localStream && remotes.length === 0 && !alwaysShowSelf) return null;

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
      {localStream ? (
        <Tile stream={localStream} name={`${localName} (you)`} muted mirrored />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-vcr-chrome/20 bg-black/25 text-[11px] text-vcr-chrome/60">
          <VideoOff className="h-4 w-4" aria-hidden />
          Your camera is off
        </div>
      )}
      {remotes.map((r) => (
        <Tile key={r.id} stream={r.stream} name={r.name} />
      ))}
      {remotes.length === 0 && (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-vcr-chrome/15 bg-black/20 px-2 text-center text-[11px] text-vcr-chrome/50">
          Waiting for the other camera
        </div>
      )}
    </div>
  );
}


export default VcrVideoTiles;
