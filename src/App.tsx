import { useState } from "react";
import { LibraryPanel as Library } from "./components/LibraryPanel";
import { MonitorPanel as Monitor } from "./components/MonitorPanel";
import { StatusPanel as LiveStatus } from "./components/StatusPanel";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";


function App() {
  const [draft, setDraft] = useState("PRÊT POUR SÉLECTION");
  const [live, setLive] = useState("FOCUS PRO STANDBY");

  const handleTake = async () => {
    // 1. On met à jour l'interface locale (ce que TU vois)
    setLive(draft);

    // 2. On envoie à la fenêtre de projection (ce que l'ÉGLISE voit)
    try {
      await invoke("send_to_projection", { 
        payload: { content: draft } 
      });
    } catch (error) {
      console.error("Erreur d'envoi :", error);
      // Si ça arrive ici, c'est probablement que la fenêtre de projection n'est pas ouverte
    }
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="module-panel" style={{height: '40px', flexDirection: 'row', alignItems: 'center', padding: '0 15px', justifyContent: 'space-between'}}>
        <div style={{color: 'var(--gold)', fontWeight: 900, letterSpacing: '3px'}}>FOCUS PRO</div>
        <div style={{fontSize: '10px', color: 'var(--text-dim)'}}>STUDIO MODE // v2.0</div> 
      </header>

      {/* WORKSPACE MIDDLE */}
      <div className="main-workspace">
        <Library onSelect={(txt: string) => setDraft(txt)} />
        
        {/* Preview Central */}
        <div className="module-panel" style={{flex: 1}}>
          <div className="module-header"><h2>Preview (Brouillon)</h2></div>
          <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505'}}>
            <div style={{fontSize: '2rem', color: '#333', textAlign: 'center', padding: '20px'}}>{draft}</div>
          </div>
        </div>

        <LiveStatus />
      </div>

      {/* FOOTER LIVE CONSOLE */}
      <footer className="module-panel" style={{height: '180px', flexDirection: 'row', padding: '15px', gap: '20px'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px', width: '150px'}}>
           <button className="btn-gold active">Logo On</button>
           <button className="btn-gold" onClick={() => setLive("")}>Blackout</button>
        </div>

        {/* Le Moniteur Program en bas */}
        <Monitor content={live} label="PROGRAM (LIVE)" isLive={true} />

        <div style={{display: 'flex', alignItems: 'center'}}>
           <button 
             style={{height: '100px', width: '120px', background: 'var(--gold-gradient)', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}
             onClick={handleTake}
           >
             TAKE
           </button>
        </div>
      </footer>
    </div>
  );
}

export default App;