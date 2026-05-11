import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  LayoutDashboard, Camera, Settings, Zap, ZapOff,
  ChevronRight, SkipForward, Power
} from "lucide-react";
import { LibraryPanel } from "./components/LibraryPanel";
import { MonitorPanel } from "./components/MonitorPanel";
import { CamerasPanel } from "./components/CamerasPanel";
import { StatusPanel } from "./components/StatusPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { TransitionBar } from "./components/TransitionBar";
import type {
  AppState, LibraryItem, ProgramItem, MonitorInfo, TransitionType
} from "./types";
import "./App.css";

const EMPTY_PROGRAM: ProgramItem = { item: null, slideIndex: 0, timestamp: 0 };

const INIT: AppState = {
  preview:      EMPTY_PROGRAM,
  program:      EMPTY_PROGRAM,
  selectedItem: null,
  activeCamera: null,
  isBlackout:   false,
  isFreeze:     false,
  isLogoOn:     false,
  isMuted:      false,
  transition:   'fade',
};

type View = 'live' | 'cameras' | 'settings';

/* ── Global function that bypasses React closure stale issues ── */
function fireToProjection(payload: object, eventName = 'projection-update') {
  invoke('send_to_projection', { payload, eventName }).catch(() => {});
}

function buildPayload(prog: ProgramItem, transition: TransitionType): object | null {
  const item = prog.item;
  if (!item) return null;
  const slideText =
    item.slides && item.slides.length > 0
      ? item.slides[prog.slideIndex] ?? item.slides[0]
      : item.content ?? item.title;

  return {
    type:            item.type,
    title:           item.title,
    content:         slideText,
    reference:       item.reference ?? '',
    thumbnail_color: item.thumbnailColor ?? '',
    url:             item.url ?? '',
    duration:        item.duration ?? '',
    // Send the raw path — projection-main.ts calls convertFileSrc in its own context
    file_path:       item.filePath ?? '',
    transition,
  };
}

export default function App() {
  const [state, setState]     = useState<AppState>(INIT);
  const [view, setView]       = useState<View>('live');
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [activeMonitor, setActiveMonitor] = useState<number | null>(null);
  const [projOpen, setProjOpen] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  const stateRef    = useRef<AppState>(INIT);
  const projOpenRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { projOpenRef.current = projOpen; }, [projOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  /* ── Load monitors on mount ── */
  useEffect(() => {
    invoke<MonitorInfo[]>('get_monitors').then(setMonitors).catch(() => {});
  }, []);

  /* ── Hot-plug monitor watcher ── */
  useEffect(() => {
    const u = listen<MonitorInfo[]>('monitors-changed', e => {
      setMonitors(e.payload);
    });
    return () => { u.then(fn => fn()); };
  }, []);

  /* ── Projection ready handshake ── */
  useEffect(() => {
    const u = listen('projection-needs-sync', () => {
      const s = stateRef.current;
      const source = s.program.item ? s.program : s.preview;
      const payload = buildPayload(source, s.transition);
      if (payload) {
        fireToProjection(payload, 'projection-sync-content');
      }
    });
    return () => { u.then(fn => fn()); };
  }, []);

  /* ── Select item from library → put in PREVIEW ── */
  const handleSelect = useCallback((item: LibraryItem) => {
    setState(s => ({ ...s, selectedItem: item }));
  }, []);

  const handlePushToPreview = useCallback((item: LibraryItem) => {
    const prog: ProgramItem = { item, slideIndex: 0, timestamp: Date.now() };
    setState(s => ({ ...s, selectedItem: item, preview: prog }));
  }, []);

  /* ── TAKE: push PREVIEW → PROGRAM + send to projection ── */

const handleTake = useCallback(() => {
  setState(s => {
    if (!s.preview.item) return s;
    
    // 1. On prépare le prochain état
    const next = { ...s, program: { ...s.preview, timestamp: Date.now() } };
    
    // 2. On construit ce qui doit être projeté
    const payload = buildPayload(next.program, next.transition);
    
    // 3. On envoie ! (On retire la condition stricte projOpenRef si elle bloque)
    if (payload) {
      console.log("Tentative d'envoi à la projection...", payload);
      fireToProjection(payload);
      console.log("Flux envoye vers le terminal...");
    }
    
    return next;
  });
  showToast("PUSH TO LIVE"); // Pour confirmer visuellement l'action
}, [showToast]);




  /* ── Next slide in PROGRAM ── */
  const handleNextSlide = useCallback(() => {
    setState(s => {
      const slides = s.program.item?.slides;
      if (!slides) return s;
      const nextIdx = Math.min(s.program.slideIndex + 1, slides.length - 1);
      if (nextIdx === s.program.slideIndex) return s;
      const next = { ...s, program: { ...s.program, slideIndex: nextIdx, timestamp: Date.now() } };
      const payload = buildPayload(next.program, next.transition);
      if (payload && projOpenRef.current) fireToProjection(payload);
      return next;
    });
  }, []);

  /* ── Monitor slide change ── */
  const handlePreviewSlide = useCallback((idx: number) => {
    setState(s => ({ ...s, preview: { ...s.preview, slideIndex: idx } }));
  }, []);

  const handleProgramSlide = useCallback((idx: number) => {
    setState(s => {
      const next = { ...s, program: { ...s.program, slideIndex: idx, timestamp: Date.now() } };
      const payload = buildPayload(next.program, next.transition);
      if (payload && projOpenRef.current) fireToProjection(payload);
      return next;
    });
  }, []);

  /* ── Blackout ── */
  const toggleBlackout = useCallback(() => {
    setState(s => {
      const next = !s.isBlackout;
      invoke('send_blackout', { active: next }).catch(() => {});
      return { ...s, isBlackout: next };
    });
  }, []);

  /* ── Logo ── */
  const toggleLogo = useCallback(() => {
    setState(s => {
      const next = !s.isLogoOn;
      if (projOpenRef.current) {
        invoke('send_to_projection', { payload: next, eventName: 'projection-logo' }).catch(() => {});
      }
      return { ...s, isLogoOn: next };
    });
  }, []);

  /* ── Clear program ── */
  const handleClear = useCallback(() => {
    setState(s => ({ ...s, program: EMPTY_PROGRAM }));
    if (projOpenRef.current) {
      invoke('send_to_projection', { payload: null, eventName: 'projection-clear' }).catch(() => {});
    }
  }, []);

  /* ── Transition change ── */
  const handleTransition = useCallback((t: TransitionType) => {
    setState(s => ({ ...s, transition: t }));
  }, []);

  /* ── Camera select ── */
  const handleCamera = useCallback((id: string) => {
    setState(s => ({ ...s, activeCamera: s.activeCamera === id ? null : id }));
  }, []);

  /* ── Open projection on a monitor ── */
  const openProjection = useCallback(async (monitorId: number) => {
    try {
      await invoke('open_projection_window', { monitorId });
      setActiveMonitor(monitorId);
      setProjOpen(true);
      showToast('Projection ouverte');
    } catch (e) {
      showToast(`Erreur: ${e}`);
    }
  }, [showToast]);

  /* ── Close projection ── */
  const closeProjection = useCallback(async () => {
    try {
      await invoke('close_projection_window');
    } catch (_) {}
    setProjOpen(false);
    setActiveMonitor(null);
    showToast('Projection fermée');
  }, [showToast]);

  const canTake = !!state.preview.item;

  return (
    <div className="shell">
      {/* ── TITLEBAR ── */}
      <div className="titlebar">
        <div className="tb-brand">
          <div className="tb-logo">FP</div>
          <span className="tb-name">Focus Pro</span>
          <span className="tb-ver">v2.0</span>
        </div>

        <nav className="tb-nav">
          <button className={`tb-nav-btn${view === 'live' ? ' on' : ''}`} onClick={() => setView('live')}>
            <LayoutDashboard size={10} />Régie
          </button>
          <button className={`tb-nav-btn${view === 'cameras' ? ' on' : ''}`} onClick={() => setView('cameras')}>
            <Camera size={10} />Caméras
          </button>
          <button className={`tb-nav-btn${view === 'settings' ? ' on' : ''}`} onClick={() => setView('settings')}>
            <Settings size={10} />Config
          </button>
        </nav>

        <div className="tb-right">
          <div className={`tb-live-badge ${state.program.item ? 'live' : 'ready'}`}>
            <span className="tb-dot" />
            {state.program.item ? 'LIVE' : 'STANDBY'}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="toolbar">
        <button
          className={`tb-btn danger${state.isBlackout ? ' on' : ''}`}
          onClick={toggleBlackout}
          title="Blackout"
        >
          {state.isBlackout ? <Zap size={10} /> : <ZapOff size={10} />}
          Blackout
        </button>

        <button
          className={`tb-btn safe${state.isLogoOn ? ' on' : ''}`}
          onClick={toggleLogo}
          title="Logo"
        >
          Logo
        </button>

        <div className="tb-sep" />

        <button className="tb-btn" onClick={handleClear} title="Effacer programme">
          <Power size={10} />Clear
        </button>

        <button
          className="tb-btn"
          onClick={handleNextSlide}
          disabled={!state.program.item?.slides || state.program.slideIndex >= (state.program.item.slides.length - 1)}
          title="Diapo suivante"
        >
          <SkipForward size={10} />Suivant
        </button>

        {projOpen && (
          <div className="tb-live-info">
            <span className="tb-dot" />
            HDMI ACTIF
          </div>
        )}
      </div>

      {/* ── WORKSPACE ── */}
      {view === 'live' && (
        <div className="workspace">
          {/* LEFT — Library */}
          <LibraryPanel
            selectedItem={state.selectedItem}
            onSelect={handleSelect}
            onPushToPreview={handlePushToPreview}
          />

          {/* CENTER — Monitors + Push */}
          <div className="center-col">
            <div className="monitors-row">
              <MonitorPanel
                label="PREVIEW"
                item={state.preview}
                onSlideChange={handlePreviewSlide}
              />
              <MonitorPanel
                label="PROGRAM"
                item={state.program}
                isLive
                onSlideChange={handleProgramSlide}
              />
            </div>

            <TransitionBar transition={state.transition} onChange={handleTransition} />

            <div className="push-zone">
              <button className="btn-clear" onClick={handleClear}>Clear</button>
              <button
                className="btn-take"
                onClick={handleTake}
                disabled={!canTake}
              >
                <ChevronRight size={14} />
                PUSH TO LIVE
              </button>
              {state.program.item?.slides && state.program.item.slides.length > 1 && (
                <button className="btn-next" onClick={handleNextSlide}>
                  <SkipForward size={10} />Next
                </button>
              )}
            </div>
          </div>

          {/* RIGHT — Status */}
          <StatusPanel />
        </div>
      )}

      {view === 'cameras' && (
        <div className="workspace">
          <CamerasPanel
            activeCamera={state.activeCamera}
            onSelectCamera={handleCamera}
            monitors={monitors}
            activeMonitor={activeMonitor}
            onOpenProjection={openProjection}
            onCloseProjection={closeProjection}
            projOpen={projOpen}
          />
          <StatusPanel />
        </div>
      )}

      {view === 'settings' && (
        <div className="workspace" style={{ gridTemplateColumns: '1fr 240px' }}>
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="ph"><span className="ph-title">Configuration</span></div>
            <SettingsPanel />
          </div>
          <StatusPanel />
        </div>
      )}

      {/* ── BLACKOUT OVERLAY ── */}
      {state.isBlackout && (
        <div className="blackout" onClick={toggleBlackout}>
          <span className="blackout-lbl">BLACKOUT — cliquez pour désactiver</span>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
