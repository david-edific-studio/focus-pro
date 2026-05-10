import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProgramItem } from '../types';

interface Props {
  label: 'PREVIEW' | 'PROGRAM';
  item: ProgramItem;
  isLive?: boolean;
  onSlideChange?: (index: number) => void;
}

export function MonitorPanel({ label, item, isLive = false, onSlideChange }: Props) {
  const [hovered, setHovered] = useState(false);

  const slides = item.item?.slides;
  const total = slides?.length ?? 0;
  const idx = item.slideIndex;
  const hasSlides = total > 1;

  const displayText = (() => {
    if (!item.item) return null;
    if (item.item.slides && item.item.slides.length > 0) return item.item.slides[idx] ?? item.item.slides[0];
    return item.item.content ?? item.item.title;
  })();

  const isMedia = item.item?.type === 'photo' || item.item?.type === 'video';
  const isAudio = item.item?.type === 'audio';
  const isWeb = item.item?.type === 'web';
  const isCamera = item.item?.type === 'camera';

  return (
    <div className="panel monitor-wrap" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="ph" style={{ borderColor: isLive ? 'rgba(240,48,48,.25)' : undefined }}>
        <span className="ph-title" style={{ color: isLive ? 'var(--red)' : 'var(--gold-400)' }}>
          {label}
          {isLive && <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', marginLeft: 6, animation: 'pulse-dot 1.2s infinite', verticalAlign: 'middle' }} />}
        </span>
        {item.item && (
          <span className={`tag tag-${item.item.type === 'bible' ? 'bible' : item.item.type === 'song' ? 'song' : item.item.type === 'pptx' ? 'pptx' : item.item.type === 'web' ? 'web' : item.item.type === 'camera' ? 'live' : 'media'}`}>
            {item.item.type}
          </span>
        )}
      </div>

      {/* 16:9 screen */}
      <div className="monitor-ratio" style={{ border: isLive ? '1px solid rgba(240,48,48,.3)' : '1px solid rgba(212,175,55,.08)' }}>
        <div className={`monitor-screen${isLive ? ' live-glow' : ''}`}>
          <span className={`monitor-badge ${isLive ? 'live' : 'preview'}`}>
            {isLive ? '● LIVE' : '◎ PRV'}
          </span>

          {!item.item && (
            <span className="monitor-standby">
              {isLive ? 'STANDBY' : '—'}
            </span>
          )}

          {item.item && isMedia && (
            <div className="monitor-media-thumb" style={{ background: item.item.thumbnailColor || '#080808' }}>
              <span style={{ fontSize: 36 }}>{item.item.type === 'photo' ? '🖼' : '🎬'}</span>
              <span style={{ fontSize: 10, color: 'var(--tx-2)', fontFamily: 'var(--mono)' }}>{item.item.title}</span>
            </div>
          )}

          {item.item && isAudio && (
            <div className="monitor-media-thumb" style={{ background: '#04040a' }}>
              <span style={{ fontSize: 32 }}>🎵</span>
              <span style={{ fontSize: 10, color: 'var(--tx-2)', fontFamily: 'var(--mono)' }}>{item.item.title}</span>
              <span style={{ fontSize: 8, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>{item.item.duration}</span>
            </div>
          )}

          {item.item && isWeb && (
            <div className="monitor-media-thumb" style={{ background: '#04040e' }}>
              <span style={{ fontSize: 30 }}>🌐</span>
              <span style={{ fontSize: 9, color: 'var(--gold-400)', fontFamily: 'var(--mono)' }}>{item.item.url}</span>
            </div>
          )}

          {item.item && isCamera && (
            <div className="monitor-media-thumb" style={{ background: '#080004' }}>
              <span style={{ fontSize: 30 }}>📹</span>
              <span style={{ fontSize: 9, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{item.item.title}</span>
            </div>
          )}

          {item.item && !isMedia && !isAudio && !isWeb && !isCamera && (
            <div className="monitor-text-wrap">
              <div className="monitor-text-main">{displayText}</div>
              {(item.item.reference || item.item.type === 'bible') && (
                <div className="monitor-text-ref">{item.item.reference || item.item.title}</div>
              )}
            </div>
          )}

          {hasSlides && (
            <span className="monitor-slide-count">{idx + 1}/{total}</span>
          )}

          {/* Arrow navigation */}
          {hasSlides && hovered && (
            <>
              <button className="monitor-nav-arrow left" onClick={() => onSlideChange?.(idx - 1)} disabled={idx === 0}>
                <ChevronLeft size={12} />
              </button>
              <button className="monitor-nav-arrow right" onClick={() => onSlideChange?.(idx + 1)} disabled={idx >= total - 1}>
                <ChevronRight size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Slide strip */}
      {hasSlides && (
        <div className="slide-strip">
          {slides!.map((s, i) => (
            <div key={i} className={`slide-thumb${i === idx ? ' on' : ''}`} onClick={() => onSlideChange?.(i)} title={s}>
              <span className="slide-num">{i + 1}</span>
              <span style={{ fontSize: 6, lineHeight: 1.1, overflow: 'hidden', maxHeight: 20, wordBreak: 'break-word' }}>{s.slice(0, 14)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
