import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Moon, Pause, Play, Volume2, VolumeX, Video,
  Settings, Layers, Camera, LayoutTemplate, Zap,
  Send, SkipForward, Monitor
} from 'lucide-react';
import { LibraryPanel } from './components/LibraryPanel';
import { MonitorPanel } from './components/MonitorPanel';
import { CamerasPanel } from './components/CamerasPanel';
import { StatusPanel } from './components/StatusPanel';
import { TransitionBar } from './components/TransitionBar';
import { SettingsPanel } from './components/SettingsPanel';
import type { AppState, LibraryItem, ProgramItem, TransitionType, MonitorInfo } from './types';
import './App.css';

const EMPTY: ProgramItem = { item: null, slideIndex: 0, timestamp: 0 };
const INIT: AppState = {
  preview: EMPTY, program: EMPTY, selectedItem: null,
  activeCamera: null, isBlackout: false, isFreeze: false,
  isLogoOn: false, isMuted: false, transition: 'fade',
};

type RightTab = 'status' | 'cameras' | 'settings';

function buildPayload(item: ProgramItem, transition: TransitionType) {
  if (!item.item) return null;
  return {
    type: item.item.type,
    title: item.item.title,
    content: item.item.slides
      ? (item.item.slides[item.slideIndex] ?? item.item.slides[0])
      : (item.item.content ?? item.item.title),
    reference: item.item.reference ?? '',
    thumbnail_color: item.item.thumbnailColor ?? '#000',
    url: item.item.url ?? '',
    duration: item.item.duration ?? '',
    transition,
  };
}

function App() {
  const [state, setState]           = useState<AppState>(INIT);
  const [toast, setToast]           = useState<string | null>(null);
  const [rightTab, setRightTab]     = useState<RightTab>('status');
  const [monitors, setMonitors]     = useState<MonitorInfo[]>([]);
  const [activeMonitor, setActiveMonitor] = useState<number | null>(null);
  const [projOpen, setProjOpen]     = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /* ── Load monitors on mount ── */
  useEffect(() => {
    invoke<MonitorInfo[]>('get_monitors').then(m => {
      setMonitors(m);
    }).catch(() => {});
  }, []);

  /* ── Listen for hot-plug changes from Rust ── */
  useEffect(() => {
    const unlisten = listen<MonitorInfo[]>('monitors-changed', event => {
      setMonitors(event.payload);
      notify(`Écrans mis à jour (${event.payload.length} détectés)`);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [notify]);

  /* ── Check if projection window is already open on resume ── */
  useEffect(() => {
    invoke<boolean>('projection_is_open').then(setProjOpen).catch(() => {});
  }, []);

  /* ── Helpers ── */
  const sendToProjection = useCallback(async (item: ProgramItem, transition: TransitionType) => {
    if (!projOpen) return;
    const payload = buildPayload(item, transition);
    if (!payload) return;
    try { await invoke('send_to_projection', { payload }); } catch { /* window may be closed */ }
  }, [projOpen]);

  /* ── Library actions ── */
  const selectItem = useCallback((item: LibraryItem) =>
    setState(s => ({ ...s, selectedItem: item })), []);

  const pushToPreview = useCallback((item: LibraryItem) => {
    setState(s => ({ ...s, preview: { item, slideIndex: 0, timestamp: Date.now() }, selectedItem: item }));
    notify(`→ Preview : ${item.title}`);
  }, [notify]);

  /* ── PUSH TO LIVE: copies preview → program + sends to HDMI ── */
  const pushToProgram = useCallback(() => {
    setState(s => {
      if (!s.preview.item) return s;
      const next = { ...s, program: { ...s.preview }, isBlackout: false };
      sendToProjection(next.program, next.transition);
      return next;
    });
    notify('▶ LIVE');
  }, [sendToProjection, notify]);

  /* ── Slide navigation ── */
  const setPreviewSlide = useCallback((i: number) =>
    setState(s => ({ ...s, preview: { ...s.preview, slideIndex: i } })), []);

  const setProgramSlide = useCallback((i: number) => {
    setState(s => {
      const next = { ...s, program: { ...s.program, slideIndex: i } };
      sendToProjection(next.program, next.transition);
      return next;
    });
  }, [sendToProjection]);

  /* ── Next slide on preview ── */
  const nextSlide = useCallback(() => setState(s => {
    const slides = s.preview.item?.slides;
    if (!slides) return s;
    const i = Math.min(s.preview.slideIndex + 1, slides.length - 1);
    return { ...s, preview: { ...s.preview, slideIndex: i } };
  }), []);

  /* ── Toolbar toggles ── */
  const toggleBlackout = useCallback(() => {
    setState(s => {
      const next = !s.isBlackout;
      invoke('send_blackout', { active: next }).catch(() => {});
      return { ...s, isBlackout: next };
    });
  }, []);

  const toggleFreeze = useCallback(() =>
    setState(s => ({ ...s, isFreeze: !s.isFreeze })), []);

  const toggleLogo = useCallback(() => {
    setState(s => {
      const next = !s.isLogoOn;
      if (projOpen) invoke('send_to_projection', { payload: { __type: 'logo', active: next } }).catch(() => {});
      return { ...s, isLogoOn: next };
    });
  }, [projOpen]);

  const toggleMute = useCallback(() =>
    setState(s => ({ ...s, isMuted: !s.isMuted })), []);

  const setTransition = useCallback((t: TransitionType) =>
    setState(s => ({ ...s, transition: t })), []);

  const clearProgram = useCallback(() => {
    setState(s => ({ ...s, program: EMPTY }));
    if (projOpen) invoke('send_to_projection', { payload: { __type: 'clear' } }).catch(() => {});
  }, [projOpen]);

  /* ── Camera select ── */
  const selectCamera = useCallback((id: string) => {
    const item: LibraryItem = { id, type: 'camera', title: `Caméra ${id}` };
    setState(s => ({ ...s, activeCamera: id, preview: { item, slideIndex: 0, timestamp: Date.now() } }));
    notify(`📹 ${id}`);
  }, [notify]);

  /* ── HDMI projection window ── */
  const openProjection = useCallback(async (monId: number) => {
    try {
      await invoke('open_projection_window', { monitorId: monId });
      setActiveMonitor(monId);
      setProjOpen(true);
      notify(`Projection ouverte → Écran ${monId + 1}`);
      // If there's already a PROGRAM item, send it immediately
      setState(s => {
        if (s.program.item) {
          const payload = buildPayload(s.program, s.transition);
          if (payload) {
            setTimeout(() => invoke('send_to_projection', { payload }).catch(() => {}), 400);
          }
        }
        return s;
      });
    } catch (e) { notify(`Erreur : ${e}`); }
  }, [notify]);

  const closeProjection = useCallback(async () => {
    try {
      await invoke('close_projection_window');
      setActiveMonitor(null);
      setProjOpen(false);
      notify('Projection fermée');
    } catch { /* ignore */ }
  }, [notify]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'F1') { e.preventDefault(); toggleBlackout(); }
      if (e.key === 'F2') { e.preventDefault(); toggleFreeze(); }
      if (e.key === 'F3') { e.preventDefault(); toggleMute(); }
      if (e.key === 'Enter' && !e.shiftKey) pushToProgram();
      if (e.key === 'ArrowRight') nextSlide();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [toggleBlackout, toggleFreeze, toggleMute, pushToProgram, nextSlide]);

  const isLive = !!state.program.item;

  return (
    <div className="shell">
      {/* Blackout overlay (régie) */}
      {state.isBlackout && (
        <div className="blackout" onClick={toggleBlackout}>
          <span className="blackout-lbl">BLACKOUT — clic ou F1 pour désactiver</span>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* ── TITLEBAR ── */}
      <header className="titlebar">
        <div className="tb-brand">
          <div className="tb-logo">FP</div>
          <span className="tb-name">Focus Pro</span>
          <span className="tb-ver">// v2.0</span>
        </div>

        <nav className="tb-nav">
          {([
            { id: 'status',   label: 'Régie',      icon: <LayoutTemplate size={9} /> },
            { id: 'cameras',  label: 'Caméras',    icon: <Camera size={9} /> },
            { id: 'settings', label: 'Paramètres', icon: <Settings size={9} /> },
          ] as { id: RightTab; label: string; icon: React.ReactNode }[]).map(t => (
            <button key={t.id} className={`tb-nav-btn${rightTab === t.id ? ' on' : ''}`} onClick={() => setRightTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>

        <div className="tb-right">
          {isLive
            ? <div className="tb-live-badge live"><span className="tb-dot" />LIVE</div>
            : <div className="tb-live-badge ready"><span className="tb-dot" />PRÊT</div>
          }
          {projOpen && activeMonitor !== null && (
            <div className="tb-live-badge live" style={{ gap: 4 }}>
              <Monitor size={9} />HDMI {activeMonitor + 1}
            </div>
          )}
        </div>
      </header>

      {/* ── TOOLBAR ── */}
      <div className="toolbar">
        <button className={`tb-btn danger${state.isBlackout ? ' on' : ''}`} onClick={toggleBlackout} title="F1">
          <Moon size={11} />Blackout
        </button>
        <button className={`tb-btn${state.isFreeze ? ' on' : ''}`} onClick={toggleFreeze} title="F2">
          {state.isFreeze ? <Play size={11} /> : <Pause size={11} />}
          {state.isFreeze ? 'Dégel' : 'Freeze'}
        </button>
        <button className={`tb-btn safe${state.isLogoOn ? ' on' : ''}`} onClick={toggleLogo}>
          <Layers size={11} />Logo
        </button>
        <button className={`tb-btn${state.isMuted ? ' danger on' : ''}`} onClick={toggleMute} title="F3">
          {state.isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          {state.isMuted ? 'Muet' : 'Audio'}
        </button>

        <div className="tb-sep" />
        <button className="tb-btn"><Video size={11} />NDI Out</button>
        <button className="tb-btn"><Zap size={11} />RTMP</button>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={nextSlide} title="→">
          <SkipForward size={11} />Slide +
        </button>

        {isLive && (
          <div className="tb-live-info">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse-dot 1.2s infinite' }} />
            EN DIRECT : {state.program.item!.title}
          </div>
        )}
      </div>

      {/* ── WORKSPACE ── */}
      <div className="workspace">

        <LibraryPanel
          selectedItem={state.selectedItem}
          onSelect={selectItem}
          onPushToPreview={pushToPreview}
        />

        <div className="center-col">
          <div className="monitors-row">
            <MonitorPanel label="PREVIEW" item={state.preview} onSlideChange={setPreviewSlide} />
            <MonitorPanel label="PROGRAM" item={state.program} isLive onSlideChange={setProgramSlide} />
          </div>
          <TransitionBar transition={state.transition} onChange={setTransition} />
          <div className="push-zone">
            <button className="btn-clear" onClick={clearProgram}>Clear</button>
            <button
              className="btn-take"
              onClick={pushToProgram}
              disabled={!state.preview.item}
              title="Enter"
            >
              <Send size={13} />
              PUSH TO LIVE
              {projOpen && <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 4 }}>+ HDMI</span>}
            </button>
            <button className="btn-next" onClick={nextSlide} title="→">
              <SkipForward size={11} />Next
            </button>
          </div>
        </div>

        <div className="right-col">
          {rightTab === 'status' && <StatusPanel />}
          {rightTab === 'cameras' && (
            <CamerasPanel
              activeCamera={state.activeCamera}
              onSelectCamera={selectCamera}
              monitors={monitors}
              activeMonitor={activeMonitor}
              onOpenProjection={openProjection}
              onCloseProjection={closeProjection}
              projOpen={projOpen}
            />
          )}
          {rightTab === 'settings' && (
            <div className="panel" style={{ flex: 1 }}>
              <div className="ph"><span className="ph-title">Paramètres</span></div>
              <SettingsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
