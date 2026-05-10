import type { TransitionType } from '../types';

const TRANSITIONS: TransitionType[] = ['cut', 'fade', 'dissolve', 'wipe', 'slide'];

interface Props {
  transition: TransitionType;
  onChange: (t: TransitionType) => void;
}

export function TransitionBar({ transition, onChange }: Props) {
  return (
    <div className="trans-strip">
      <span className="trans-label">Transition :</span>
      {TRANSITIONS.map(t => (
        <button key={t} className={`trans-chip${transition === t ? ' on' : ''}`} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}
