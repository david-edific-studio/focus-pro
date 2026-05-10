import { useEffect, useState } from 'react';
import { Cpu, Monitor, HardDrive, Wifi } from 'lucide-react';

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function useMeters() {
  const [m, setM] = useState({ cpu: 10, gpu: 6, a1: 65, a2: 70 });
  useEffect(() => {
    const id = setInterval(() => setM({
      cpu: Math.min(90, Math.max(5, Math.random() * 18 + 8)),
      gpu: Math.min(90, Math.max(3, Math.random() * 25 + 5)),
      a1: Math.min(92, Math.max(10, Math.random() * 38 + 52)),
      a2: Math.min(92, Math.max(10, Math.random() * 38 + 48)),
    }), 900);
    return () => clearInterval(id);
  }, []);
  return m;
}

export function StatusPanel() {
  const t = useClock();
  const m = useMeters();
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
  const date = t.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="ph"><span className="ph-title">Système</span><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} /></div>

      <div className="fp-clock">{time}</div>
      <div className="fp-date">{date}</div>

      <div className="divider" />

      <div className="stat-list">
        <div className="stat-row">
          <span className="stat-key"><Cpu size={9} />CPU</span>
          <span className="stat-val ok">{m.cpu.toFixed(0)}%</span>
        </div>
        <div className="meter-row" style={{ padding: '0 8px 4px' }}>
          <div className="meter-track"><div className="meter-fill" style={{ width: `${m.cpu}%` }} /></div>
        </div>
        <div className="stat-row">
          <span className="stat-key"><Monitor size={9} />GPU</span>
          <span className="stat-val ok">{m.gpu.toFixed(0)}%</span>
        </div>
        <div className="meter-row" style={{ padding: '0 8px 4px' }}>
          <div className="meter-track"><div className="meter-fill" style={{ width: `${m.gpu}%` }} /></div>
        </div>
        <div className="stat-row">
          <span className="stat-key"><Wifi size={9} />NDI</span>
          <span className="stat-val ok">ACTIF</span>
        </div>
        <div className="stat-row">
          <span className="stat-key"><HardDrive size={9} />Disk</span>
          <span className="stat-val gold">234 GB</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Moteur</span>
          <span className="stat-val gold">Vulkan</span>
        </div>
        <div className="stat-row" style={{ borderBottom: 'none' }}>
          <span className="stat-key">Latence</span>
          <span className="stat-val ok">1.2ms</span>
        </div>
      </div>

      <div className="divider" />

      <div style={{ padding: '4px 8px 2px', fontSize: 7, color: 'var(--tx-3)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>Audio</div>
      <div className="audio-meters">
        {[{ label: 'CH 1', val: m.a1 }, { label: 'CH 2', val: m.a2 }, { label: 'MIC', val: 28 }].map(ch => (
          <div key={ch.label} className="audio-ch">
            <span className="audio-ch-lbl">{ch.label}</span>
            <div className="audio-ch-track"><div className="audio-ch-fill" style={{ width: `${ch.val}%` }} /></div>
            <span className="audio-ch-db">{(ch.val / 100 * 12 - 12).toFixed(0)}dB</span>
          </div>
        ))}
      </div>
    </div>
  );
}
