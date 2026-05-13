import React, { useEffect, useMemo, useState } from 'react';
import { Film, Image as ImageIcon, Pause, Play, SkipForward } from 'lucide-react';
import type { HandoffShot, VideoHandoffSample } from '../../types/videoHandoff';

interface HandoffPlayerProps {
  sample: VideoHandoffSample;
  selectedShotId: string | null;
  onSelectShot: (shotId: string) => void;
}

function resolveMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/uploads/')) return `http://localhost:4300${path}`;
  return path;
}

function isVideoUrl(url?: string): boolean {
  return Boolean(url?.match(/\.(mp4|mov|webm|m4v)(\?|#|$)/i));
}

function shotLabel(shot: HandoffShot): string {
  return `镜头 ${shot.index} · ${shot.durationSeconds}s`;
}

export const HandoffPlayer: React.FC<HandoffPlayerProps> = ({ sample, selectedShotId, onSelectShot }) => {
  const selectedShot = sample.shots.find(shot => shot.id === selectedShotId) || sample.shots[0];
  const selectedIndex = useMemo(
    () => Math.max(0, sample.shots.findIndex(shot => shot.id === selectedShot?.id)),
    [sample.shots, selectedShot?.id],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaUrl = resolveMediaUrl(sample.previewVideoUrl || selectedShot?.source.assetUrl);
  const canRenderVideo = isVideoUrl(mediaUrl) || Boolean(sample.previewVideoUrl);

  useEffect(() => {
    if (!isPlaying || sample.shots.length <= 1) return undefined;

    const delay = Math.max(1600, Math.min(3600, (selectedShot?.durationSeconds || 5) * 450));
    const timer = window.setTimeout(() => {
      const nextIndex = selectedIndex + 1;
      if (nextIndex >= sample.shots.length) {
        setIsPlaying(false);
        return;
      }
      onSelectShot(sample.shots[nextIndex].id);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isPlaying, onSelectShot, sample.shots, selectedIndex, selectedShot?.durationSeconds]);

  return (
    <section className="handoff-player" aria-label="视频交接样片播放器">
      <div className="handoff-player__header">
        <div>
          <p className="handoff-kicker">{sample.positioningLabel}</p>
          <h1>{sample.title}</h1>
        </div>
        <div className="handoff-player__meta">
          <Film size={16} />
          <span>{sample.shots.length} 个镜头</span>
        </div>
      </div>

      <div className="handoff-player__stage">
        {mediaUrl && canRenderVideo ? (
          <video src={mediaUrl} controls className="handoff-player__media" />
        ) : mediaUrl ? (
          <img src={mediaUrl} alt={selectedShot?.visualIntent || sample.title} className="handoff-player__media" />
        ) : (
          <div className="handoff-player__empty">
            <Play size={40} />
            <span>{sample.emptyState ? '等待报道和素材' : '样片预览生成中'}</span>
          </div>
        )}

        {selectedShot && (
          <>
            <div className="handoff-player__source">
              {selectedShot.source.type === 'uploaded_asset' ? <ImageIcon size={14} /> : <Film size={14} />}
              <span>{selectedShot.source.label}</span>
            </div>
            <button
              type="button"
              className="handoff-player__play-toggle"
              onClick={() => setIsPlaying(previous => !previous)}
              aria-label={isPlaying ? '暂停样片播放' : '播放样片'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              <span>{isPlaying ? '暂停样片' : '播放样片'}</span>
            </button>
            <div className="handoff-player__caption">
              <strong>{shotLabel(selectedShot)}</strong>
              <span>{selectedShot.captionOrVoiceover || selectedShot.visualIntent}</span>
            </div>
          </>
        )}
      </div>

      <div className="handoff-player__timeline" aria-label="样片镜头列表">
        {sample.shots.map(shot => (
          <button
            key={shot.id}
            type="button"
            className={shot.id === selectedShot?.id ? 'is-active' : ''}
            onClick={() => onSelectShot(shot.id)}
          >
            <SkipForward size={14} />
            <span>{shotLabel(shot)}</span>
            <small>{shot.source.label}</small>
          </button>
        ))}
      </div>
    </section>
  );
};
