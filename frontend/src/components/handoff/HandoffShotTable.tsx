import React, { useState } from 'react';
import { Film, Image as ImageIcon, LayoutGrid, Table2 } from 'lucide-react';
import type { HandoffAssetRef, HandoffShot } from '../../types/videoHandoff';
import { assetUrl } from '../../config/api';

interface HandoffShotTableProps {
  shots: HandoffShot[];
  selectedShotId: string | null;
  pendingShotIds?: string[];
  onSelectShot: (shotId: string) => void;
}

export const HandoffShotTable: React.FC<HandoffShotTableProps> = ({
  shots,
  selectedShotId,
  pendingShotIds = [],
  onSelectShot,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  return (
    <section id="handoff-shot-table" className="handoff-shot-table" aria-label="分镜卡片与结构化分镜表">
      <div className="handoff-section-heading">
        <div>
          <h2>{viewMode === 'cards' ? '分镜卡片' : '结构化分镜表'}</h2>
          <span>交接依据 · 点击卡片可同步右侧 Agent 和上方样片</span>
        </div>
        <div className="handoff-view-toggle" aria-label="分镜视图切换">
          <button
            type="button"
            className={viewMode === 'cards' ? 'is-active' : ''}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid size={14} />
            卡片
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'is-active' : ''}
            onClick={() => setViewMode('table')}
          >
            <Table2 size={14} />
            表格
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="handoff-shot-card-grid">
          {shots.map(shot => (
            <HandoffShotCard
              key={shot.id}
              shot={shot}
              isSelected={shot.id === selectedShotId}
              isPending={pendingShotIds.includes(shot.id)}
              onSelect={() => onSelectShot(shot.id)}
            />
          ))}
        </div>
      ) : (
        <div className="handoff-shot-table__scroll">
          <table>
            <thead>
              <tr>
                <th>镜头</th>
                <th>画面意图</th>
                <th>字幕/旁白</th>
                <th>素材来源</th>
                <th>制作备注</th>
              </tr>
            </thead>
            <tbody>
              {shots.map(shot => {
                const isSelected = shot.id === selectedShotId;
                const isPending = pendingShotIds.includes(shot.id);
                const rowClassName = [isSelected ? 'is-selected' : '', isPending ? 'is-pending' : '']
                  .filter(Boolean)
                  .join(' ');

                return (
                  <tr key={shot.id} className={rowClassName} onClick={() => onSelectShot(shot.id)}>
                    <td>
                      <strong>{shot.index}</strong>
                      <span>{shot.durationSeconds}s</span>
                    </td>
                    <td>{shot.visualIntent}</td>
                    <td>{shot.captionOrVoiceover || '待补充'}</td>
                    <td>
                      <div className="handoff-table-source">
                        <span className="handoff-source-pill">{shot.source.label}</span>
                        <HandoffAssetThumbs assetRefs={shot.assetRefs} compact />
                      </div>
                    </td>
                    <td>{shot.productionNote}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

function resolveMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/uploads/')) return assetUrl(path);
  return path;
}

function assetPreviewUrl(assetRef: HandoffAssetRef): string | undefined {
  return resolveMediaUrl(assetRef.url || assetRef.originalPath);
}

function HandoffAssetThumbs({
  assetRefs,
  compact = false,
}: {
  assetRefs: HandoffAssetRef[];
  compact?: boolean;
}) {
  if (assetRefs.length === 0) {
    return (
      <div className={compact ? 'handoff-asset-thumbs is-compact' : 'handoff-asset-thumbs'}>
        <span className="handoff-asset-thumb is-empty">
          <Film size={compact ? 12 : 14} />
        </span>
        {!compact && <span className="handoff-asset-thumbs__label">AI 补充画面</span>}
      </div>
    );
  }

  const visibleRefs = assetRefs.slice(0, compact ? 3 : 4);
  const hiddenCount = assetRefs.length - visibleRefs.length;

  return (
    <div className={compact ? 'handoff-asset-thumbs is-compact' : 'handoff-asset-thumbs'} aria-label="素材缩略图">
      {visibleRefs.map(assetRef => {
        const previewUrl = assetPreviewUrl(assetRef);
        const canShowImage = assetRef.fileType === 'image' && previewUrl;

        return (
          <span className="handoff-asset-thumb" key={assetRef.id} title={assetRef.fileName}>
            {canShowImage ? (
              <img src={previewUrl} alt="" />
            ) : (
              <Film size={compact ? 12 : 14} />
            )}
          </span>
        );
      })}
      {hiddenCount > 0 && <span className="handoff-asset-thumb is-more">+{hiddenCount}</span>}
      {!compact && <span className="handoff-asset-thumbs__label">进入分镜</span>}
    </div>
  );
}

function HandoffShotCard({
  shot,
  isSelected,
  isPending,
  onSelect,
}: {
  shot: HandoffShot;
  isSelected: boolean;
  isPending: boolean;
  onSelect: () => void;
}) {
  const mediaUrl = resolveMediaUrl(shot.source.assetUrl);
  const className = [
    'handoff-shot-card',
    'nm-storyboard-card',
    isSelected ? 'is-selected' : '',
    isSelected ? 'nm-storyboard-card-selected' : '',
    isPending ? 'is-pending' : '',
  ].filter(Boolean).join(' ');

  return (
    <button type="button" className={className} onClick={onSelect}>
      <div className="handoff-shot-card__media nm-storyboard-media">
        {mediaUrl ? (
          <img src={mediaUrl} alt={shot.visualIntent} />
        ) : (
          <div className="handoff-shot-card__placeholder">
            <Film size={24} />
            <span>AI 参考画面</span>
          </div>
        )}
        <span className="handoff-shot-card__index">镜头 {shot.index} · {shot.durationSeconds}s</span>
        <span className="handoff-shot-card__source">
          {shot.source.type === 'uploaded_asset' ? <ImageIcon size={12} /> : <Film size={12} />}
          {shot.source.label}
        </span>
      </div>

      <div className="handoff-shot-card__body nm-storyboard-card-content">
        <div>
          <span>镜头重点</span>
          <p>{shot.visualIntent}</p>
        </div>
        <div>
          <span>字幕/旁白</span>
          <p>{shot.captionOrVoiceover || '待补充'}</p>
        </div>
        <div>
          <span>制作备注</span>
          <p>{shot.productionNote}</p>
        </div>
      </div>

      <div className="handoff-shot-card__footer nm-storyboard-card-footer">
        <span className="handoff-source-pill">{shot.source.label}</span>
        <HandoffAssetThumbs assetRefs={shot.assetRefs} />
      </div>
    </button>
  );
}
