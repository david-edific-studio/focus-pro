import { useState } from 'react';
import { Monitor, Wifi, Layout, Volume2, BookOpen, Sliders } from 'lucide-react';

export function SettingsPanel() {
  const [res, setRes] = useState('1920x1080');
  const [fps, setFps] = useState('60');
  const [display, setDisplay] = useState('Display 2');
  const [ndi, setNdi] = useState(true);
  const [rtmp, setRtmp] = useState(false);
  const [webStream, setWebStream] = useState(false);
  const [fontScale, setFontScale] = useState('100');
  const [align, setAlign] = useState('center');
  const [safeZone, setSafeZone] = useState(true);
  const [delay, setDelay] = useState('0');
  const [vol, setVol] = useState('85');
  const [bibleVer, setBibleVer] = useState('LSG 1910');

  const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
    <select className="fp-select" style={{ flex: 'none', width: 'auto', fontSize: 9 }} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <div className={`toggle${on ? ' on' : ''}`} onClick={toggle} />
  );

  return (
    <div className="settings-scroll">
      <div className="setting-card">
        <div className="sc-title"><Monitor size={9} />Sortie Vidéo</div>
        <div className="sc-row"><span className="sc-lbl">Affichage</span><Select value={display} onChange={setDisplay} options={['Display 1', 'Display 2', 'Display 3', 'Virtuel']} /></div>
        <div className="sc-row"><span className="sc-lbl">Résolution</span><Select value={res} onChange={setRes} options={['1280x720', '1920x1080', '2560x1440', '3840x2160']} /></div>
        <div className="sc-row"><span className="sc-lbl">Fréquence</span><Select value={fps} onChange={setFps} options={['24', '25', '30', '50', '60']} /></div>
      </div>

      <div className="setting-card">
        <div className="sc-title"><Wifi size={9} />Streaming</div>
        <div className="sc-row"><span className="sc-lbl">NDI Output</span><Toggle on={ndi} toggle={() => setNdi(v => !v)} /></div>
        <div className="sc-row"><span className="sc-lbl">RTMP Out</span><Toggle on={rtmp} toggle={() => setRtmp(v => !v)} /></div>
        <div className="sc-row"><span className="sc-lbl">Web Stream</span><Toggle on={webStream} toggle={() => setWebStream(v => !v)} /></div>
      </div>

      <div className="setting-card">
        <div className="sc-title"><Layout size={9} />Affichage Texte</div>
        <div className="sc-row"><span className="sc-lbl">Taille police</span><Select value={fontScale} onChange={setFontScale} options={['75', '100', '125', '150', '175']} /></div>
        <div className="sc-row"><span className="sc-lbl">Alignement</span><Select value={align} onChange={setAlign} options={['Gauche', 'Centre', 'Droite']} /></div>
        <div className="sc-row"><span className="sc-lbl">Zone sécurisée</span><Toggle on={safeZone} toggle={() => setSafeZone(v => !v)} /></div>
      </div>

      <div className="setting-card">
        <div className="sc-title"><Volume2 size={9} />Audio</div>
        <div className="sc-row"><span className="sc-lbl">Volume Master</span><span className="sc-val">{vol}%</span></div>
        <input type="range" min="0" max="100" value={vol} onChange={e => setVol(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="sc-row"><span className="sc-lbl">Délai audio</span><Select value={delay} onChange={setDelay} options={['0ms', '20ms', '40ms', '80ms']} /></div>
      </div>

      <div className="setting-card">
        <div className="sc-title"><BookOpen size={9} />Bible</div>
        <div className="sc-row"><span className="sc-lbl">Version</span><Select value={bibleVer} onChange={setBibleVer} options={['LSG 1910', 'Louis Segond', 'NEG', 'TOB', 'NIV (EN)']} /></div>
        <div className="sc-row"><span className="sc-lbl">Afficher référence</span><Toggle on={true} toggle={() => {}} /></div>
      </div>

      <div className="setting-card">
        <div className="sc-title"><Sliders size={9} />Système</div>
        <div className="sc-row"><span className="sc-lbl">Moteur rendu</span><span className="sc-val">Vulkan</span></div>
        <div className="sc-row"><span className="sc-lbl">Version</span><span className="sc-val">2.0.0</span></div>
      </div>
    </div>
  );
}
