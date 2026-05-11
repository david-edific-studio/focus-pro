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

/* Push a payload directly to projection, bypassing React state closure issues */
function fireToProjection(payload: object, eventName = 'projection-update') {
  invoke('send_to_projection', { payload, eventName }).catch(() => {});
}

function App() {
  const [state, setState]                 = useState<AppState>(INIT);
  const [toast, setToast]                 = useState<string | null>(null);
  const [rightTab, setRightTab]           = useState<RightTab>('status');
  const [monitors, setMonitors]           = useState<MonitorInfo[]>([]);
  const [activeMonitor, setActiveMonitor] = useState<number | null>(null);
  const [projOpen, setProjOpen]           = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Always-fresh ref to state — readable inside any callback without closure staleness */
  const stateRef = useRef<AppState>(INIT);
  useEffect(() => { stateRef.current = state; }, [state]);

  /* Always-fresh ref to projOpen */
  const projOpenRef = useRef(false);
  useEffect(() => { projOpenRef.current = projOpen; }, [projOpen]);

  const notify = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /* ── Load monitors on mount ── */
  useEffect(() => {
    invoke<MonitorInfo[]>('get_monitors').then(setMonitors).catch(() => {});
  }, []);

  /* ── Listen for HDMI hot-plug ── */
  useEffect(() => {
    const u = listen<MonitorInfo[]>('monitors-changed', e => {
      setMonitors(e.payload);
      notify(`Écrans mis à jour (${e.payload.length} détectés)`);
    });
    return () => { u.then(fn => fn()); };
  }, [notify]);

  /* ── Check if projection already open ── */
  useEffect(() => {
    invoke<boolean>('projection_is_open').then(open => {
      setProjOpen(open);
      projOpenRef.current = open;
    }).catch(() => {});
  }, []);

  /* ── projection-needs-sync : projection window just became ready ──
     Read stateRef (always fresh) and send PROGRAM if any, else PREVIEW. */
  useEffect(() => {
    const u = listen('projection-needs-sync', () => {
      const s = stateRef.current;
      /* Pick PROGRAM if it has content, otherwise PREVIEW */
      const source = s.program.item ? s.program : s.preview;
      const payload = buildPayload(source, s.transition);
      if (payload) {
        fireToProjection(payload, 'projection-sync-content');
      }
    });
    return () => { u.then(fn => fn()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Core helper: send current PROGRAM to projection ── */
  const pushProgram = useCallback((programItem: ProgramItem, transition: TransitionType) => {
    if (!projOpenRef.current) return;
    const payload = buildPayload(programItem, transition);
    if (payload) fireToProjection(payload, 'projection-update');
  }, []);

  /* ── Library ── */
  const selectItem = useCallback((item: LibraryItem) =>
    setState(s => ({ ...s, selectedItem: item })), []);

  const pushToPreview = useCallback((item: LibraryItem) => {
    setState(s => ({ ...s, preview: { item, slideIndex: 0, timestamp: Date.now() }, selectedItem: item }));
    notify(`→ Preview : ${item.title}`);
  }, [notify]);

  /* ── PUSH TO LIVE ── */
  const pushToProgram = useCallback(() => {
    setState(s => {
      if (!s.preview.item) return s;
      const newProgram: ProgramItem = { ...s.preview };
      const next = { ...s, program: newProgram, isBlackout: false };
      /* Use stateRef transition (always fresh) */
      pushProgram(newProgram, s.transition);
      return next;
    });
    notify('▶ LIVE');
  }, [pushProgram, notify]);

  /* ── Slide navigation PREVIEW ── */
  const setPreviewSlide = useCallback((i: number) =>
    setState(s => ({ ...s, preview: { ...s.preview, slideIndex: i } })), []);

  /* ── Slide navigation PROGRAM — mirrors to HDMI immediately ── */
  const setProgramSlide = useCallback((i: number) => {
    setState(s => {
      const newProgram = { ...s.program, slideIndex: i };
      pushProgram(newProgram, s.transition);
      return { ...s, program: newProgram };
    });
  }, [pushProgram]);

  /* ── Next slide (preview) ── */
  const nextSlide = useCallback(() => setState(s => {
    const slides = s.preview.item?.slides;
    if (!slides) return s;
    return { ...s, preview: { ...s.preview, slideIndex: Math.min(s.preview.slideIndex + 1, slides.length - 1) } };
  }), []);

  /* ── Blackout ── */
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
      if (projOpenRef.current) fireToProjection({ active: next }, 'projection-logo');
      return { ...s, isLogoOn: next };
    });
  }, []);

  const toggleMute = useCallback(() =>
    setState(s => ({ ...s, isMuted: !s.isMuted })), []);

  const setTransition = useCallback((t: TransitionType) =>
    setState(s => ({ ...s, transition: t })), []);

  const clearProgram = useCallback(() => {
    setState(s => ({ ...s, program: EMPTY }));
    if (projOpenRef.current) fireToProjection({}, 'projection-clear');
  }, []);

  const selectCamera = useCallback((id: string) => {
    const item: LibraryItem = { id, type: 'camera', title: `Caméra ${id}` };
    setState(s => ({ ...s, activeCamera: id, preview: { item, slideIndex: 0, timestamp: Date.now() } }));
    notify(`📹 ${id}`);
  }, [notify]);

  /* ── Open HDMI projection window ── */
  const openProjection = useCallback(async (monId: number) => {
    try {
      await invoke('open_projection_window', { monitorId: monId });
      setActiveMonitor(monId);
      setProjOpen(true);
      projOpenRef.current = true;
      notify(`Projection ouverte → Écran ${monId + 1}`);
      /* projection-needs-sync will fire automatically from projection-main.ts
         once its listeners are registered (~100ms). We DON'T send here to
         avoid a race where the window isn't ready yet. */
    } catch (e) { notify(`Erreur : ${e}`); }
  }, [notify]);

  const closeProjection = useCallback(async () => {
    try {
      await invoke('close_projection_window');
      setActiveMonitor(null);
      setProjOpen(false);
      projOpenRef.current = false;
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
      {state.isBlackout && (
        <div className="blackout" onClick={toggleBlackout}>
          <span className="blackout-lbl">BLACKOUT — clic ou F1 pour désactiver</span>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

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
