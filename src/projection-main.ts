import { listen } from '@tauri-apps/api/event';

interface ProjectionPayload {
  type: string;
  title?: string;
  content?: string;
  reference?: string;
  thumbnail_color?: string;
  url?: string;
  duration?: string;
  transition?: string;
}

const standby       = document.getElementById('standby')!;
const textDisplay   = document.getElementById('text-display')!;
const mainText      = document.getElementById('main-text')!;
const refText       = document.getElementById('ref-text')!;
const mediaDisplay  = document.getElementById('media-display')!;
const mediaIcon     = document.getElementById('media-icon')!;
const mediaTitle    = document.getElementById('media-title')!;
const mediaSub      = document.getElementById('media-sub')!;
const blackout      = document.getElementById('blackout')!;
const logoOverlay   = document.getElementById('logo-overlay')!;
const slideCounter  = document.getElementById('slide-counter')!;
const stage         = document.getElementById('stage')!;

const MEDIA_TYPES = new Set(['photo', 'video', 'audio', 'camera']);
const MEDIA_ICONS: Record<string, string> = {
  photo: '🖼', video: '🎬', audio: '🎧', camera: '📹', web: '🌐',
};

function applyTransition(transition = 'fade') {
  textDisplay.className = '';
  mediaDisplay.className = '';
  void textDisplay.offsetWidth;
  textDisplay.classList.add(`transition-${transition}`);
  mediaDisplay.classList.add(`transition-${transition}`);
}

function showContent(payload: ProjectionPayload) {
  standby.classList.add('hidden');
  applyTransition(payload.transition);

  const isMedia = MEDIA_TYPES.has(payload.type) || payload.type === 'web';

  if (isMedia) {
    textDisplay.classList.add('hidden');
    mediaDisplay.classList.add('active');
    mediaIcon.textContent  = MEDIA_ICONS[payload.type] || '📄';
    mediaTitle.textContent = payload.title || '';
    mediaSub.textContent   = payload.type === 'web' ? (payload.url || '') : (payload.duration || payload.type.toUpperCase());
    if (payload.thumbnail_color) {
      stage.style.background = payload.thumbnail_color;
    }
  } else {
    textDisplay.classList.remove('hidden');
    mediaDisplay.classList.remove('active');
    mediaDisplay.className = '';
    stage.style.background = '#000';
    mainText.textContent = payload.content || payload.title || '';
    refText.textContent  = payload.reference || '';
  }
}

function showStandby() {
  standby.classList.remove('hidden');
  textDisplay.classList.add('hidden');
  mediaDisplay.classList.remove('active');
  stage.style.background = '#000';
  slideCounter.textContent = '';
}

/* ── LISTEN TO TAURI EVENTS ── */
listen<ProjectionPayload>('projection-update', event => {
  showContent(event.payload);
});

listen<boolean>('projection-blackout', event => {
  if (event.payload) {
    blackout.classList.add('active');
  } else {
    blackout.classList.remove('active');
  }
});

listen<boolean>('projection-logo', event => {
  if (event.payload) {
    logoOverlay.classList.add('active');
  } else {
    logoOverlay.classList.remove('active');
  }
});

listen<null>('projection-clear', () => {
  showStandby();
});

/* ── KEYBOARD: ESC closes blackout ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') blackout.classList.remove('active');
});

showStandby();
