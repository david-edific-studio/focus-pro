import { Camera, Wifi, WifiOff, Monitor, MonitorOff, MonitorCheck } from 'lucide-react';
import type { MonitorInfo } from '../types';

const CAMS = [
  { id: 'cam1', label: 'CAM 1 Podium' },
  { id: 'cam2', label: 'CAM 2 Large' },
  { id: 'cam3', label: 'CAM 3 Chorale' },
  { id: 'cam4', label: 'CAM 4 Haut' },
  { id: 'ndi1', label: 'NDI Stream 1' },
  { id: 'rtmp', label: 'RTMP In' },
];

const INPUTS = ['HDMI 1', 'HDMI 2', 'SDI 1', 'SDI 2', 'USB Capture'];

interface Props {
  activeCamera: string | null;
  onSelectCamera: (id: string) => void;
  monitors: MonitorInfo[];
  activeMonitor: number | null;
  onOpenProjection: (id: number) => void;
  onCloseProjection: () => void;
  projOpen: boolean;
}

export function CamerasPanel({
  activeCamera, onSelectCamera,
  monitors, activeMonitor,
  onOpenProjection, onCloseProjection,
  projOpen,
}: Props) {
  return (
    <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="ph">
        <span className="ph-title">Caméras & Flux</span>
        <span className="tag tag-live" style={{ fontSize: 6.5 }}>NDI</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* ─── Camera grid ─── */}
        <div className="cam-grid">
          {CAMS.map(cam => (
            <div
              key={cam.id}
              className={`cam-feed${activeCamera === cam.id ? ' on' : ''}`}
              onClick={() => onSelectCamera(cam.id)}
              title={cam.label}
            >
              {activeCamera === cam.id
                ? <Wifi size={13} style={{ color: 'var(--red)' }} />
                : <Camera size={13} style={{ color: 'var(--tx-3)' }} />
              }
              <span className="cam-label">{cam.label.slice(0, 13)}</span>
              {activeCamera === cam.id && <span className="cam-live-dot" />}
            </div>
          ))}
        </div>

        {/* ─── Inputs ─── */}
        <div style={{ padding: '3px 8px 2px', fontSize: 7, color: 'var(--tx-3)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'var(--mono)', borderTop: '1px solid var(--bdr-1)', marginTop: 2 }}>
          Entrées vidéo
        </div>
        <div style={{ padding: '3px 6px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {INPUTS.map(src => (
            <div
              key={src}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', background: 'var(--bg-600)', borderRadius: 'var(--r-sm)',
                fontSize: 9, color: 'var(--tx-3)', cursor: 'pointer',
                border: '1px solid var(--bdr-1)', fontFamily: 'var(--mono)', letterSpacing: 0.5,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold-border)';
                (e.currentTarget as HTMLDivElement).style.color = 'var(--tx-2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bdr-1)';
                (e.currentTarget as HTMLDivElement).style.color = 'var(--tx-3)';
              }}
            >
              {src}<WifiOff size={9} />
            </div>
          ))}
        </div>

        {/* ─── HDMI / Sorties ─── */}
        <div style={{
          padding: '6px 8px 4px',
          fontSize: 7, color: 'var(--tx-3)', letterSpacing: 2, textTransform: 'uppercase',
          fontFamily: 'var(--mono)', borderTop: '1px solid var(--bdr-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Sorties HDMI</span>
          <span style={{ color: monitors.length > 0 ? 'var(--green)' : 'var(--tx-4)' }}>
            {monitors.length} détecté{monitors.length !== 1 ? 's' : ''}
          </span>
        </div>

        {monitors.length === 0 ? (
          <div style={{
            padding: '14px 8px', textAlign: 'center',
            fontSize: 8, color: 'var(--tx-4)', fontFamily: 'var(--mono)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <MonitorOff size={20} style={{ color: 'var(--tx-4)' }} />
            <span style={{ letterSpacing: 1 }}>Aucun écran secondaire</span>
            <span style={{ fontSize: 7, color: 'var(--tx-4)', opacity: 0.6 }}>
              Branchez un câble HDMI/DP
            </span>
          </div>
        ) : (
          <div style={{ padding: '4px 6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {monitors.map(mon => {
              const isActive = activeMonitor === mon.id && projOpen;
              return (
                <div
                  key={mon.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    background: isActive ? 'var(--red-dim)' : 'var(--bg-600)',
                    border: `1px solid ${isActive ? 'var(--red-border)' : 'var(--bdr-1)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold-border)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bdr-1)';
                  }}
                  onClick={() => isActive ? onCloseProjection() : onOpenProjection(mon.id)}
                >
                  {isActive
                    ? <MonitorCheck size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                    : <Monitor size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 500, color: isActive ? 'var(--red)' : 'var(--tx-1)', marginBottom: 2 }}>
                      {mon.name}
                    </div>
                    <div style={{ fontSize: 7.5, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>
                      {mon.width}×{mon.height}
                      {mon.is_primary ? ' · Principal' : ' · Secondaire'}
                      {` · (${mon.position_x}, ${mon.position_y})`}
                    </div>
                  </div>
                  {isActive
                    ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span className="tag tag-live" style={{ fontSize: 6, animation: 'pulse-dot 2s infinite' }}>LIVE</span>
                        <span style={{ fontSize: 6.5, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>clic = fermer</span>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 7, color: 'var(--gold-600)', fontFamily: 'var(--mono)',
                        letterSpacing: 1, textTransform: 'uppercase',
                      }}>
                        Activer
                      </span>
                    )
                  }
                </div>
              );
            })}

            {/* Hint */}
            <div style={{
              marginTop: 2, padding: '5px 8px',
              background: 'var(--bg-700)', borderRadius: 'var(--r-sm)',
              fontSize: 7.5, color: 'var(--tx-3)', lineHeight: 1.5,
              fontFamily: 'var(--mono)',
            }}>
              <span style={{ color: 'var(--gold-600)' }}>↑</span> Cliquez pour ouvrir la fenêtre de projection sur cet écran.
              Ensuite, <span style={{ color: 'var(--gold-600)' }}>PUSH TO LIVE</span> enverra le contenu directement.
            </div>

            {projOpen && (
              <button
                onClick={onCloseProjection}
                style={{
                  marginTop: 2, padding: '6px', width: '100%',
                  background: 'transparent', border: '1px solid var(--red-border)',
                  borderRadius: 'var(--r-sm)', color: 'var(--red)',
                  fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <MonitorOff size={10} /> Fermer projection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
