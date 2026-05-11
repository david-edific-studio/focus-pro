import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

function log(message: string) {
  invoke('log_from_frontend', { message }).catch(() => {});
}

interface ProjectionPayload {
  type: string;
  title?: string;
  content?: string;
  reference?: string;
  thumbnail_color?: string;
  url?: string;
  duration?: string;
  file_src?: string;
  transition?: string;
}

const standby      = document.getElementById('standby')!;
const textDisplay  = document.getElementById('text-display')!;
const mainText     = document.getElementById('main-text')!;
const refText      = document.getElementById('ref-text')!;
const videoDisplay = document.getElementById('video-display')!;
const imageDisplay = document.getElementById('image-display')!;
const audioDisplay = document.getElementById('audio-display')!;
const audioTitle   = audioDisplay.querySelector<HTMLElement>('.audio-title')!;
const audioSub     = audioDisplay.querySelector<HTMLElement>('.audio-sub')!;
const audioEl      = audioDisplay.querySelector<HTMLAudioElement>('audio')!;
const blackout     = document.getElementById('blackout')!;
const logoOverlay  = document.getElementById('logo-overlay')!;
const stage        = document.getElementById('stage')!;

function hideAll() {
  textDisplay.classList.add('hidden');
  videoDisplay.classList.remove('active');
  imageDisplay.classList.remove('active');
  audioDisplay.classList.remove('active');
  // Stop any playing media
  const oldVideo = videoDisplay.querySelector('video');
  if (oldVideo) { oldVideo.pause(); oldVideo.src = ''; }
  audioEl.pause();
  audioEl.src = '';
}

function applyTransition(el: HTMLElement, transition = 'fade') {
  el.className = el.className.replace(/transition-\S+/g, '').trim();
  void el.offsetWidth; // reflow
  el.classList.add(`transition-${transition}`);
}

function showContent(payload: ProjectionPayload) {
  standby.classList.add('hidden');
  hideAll();
  stage.style.background = '#000';

  log(`[showContent] type=${payload.type} file_src="${payload.file_src}" title="${payload.title}"`);

  switch (payload.type) {

    case 'video': {
      const src = payload.file_src || '';
      if (!src) {
        log('[video] ERREUR: file_src vide — vérifier convertFileSrc dans App.tsx');
        break;
      }
      videoDisplay.innerHTML = `<video autoplay loop playsinline src="${src}"></video>`;
      videoDisplay.classList.add('active');
      applyTransition(videoDisplay, payload.transition);
      const vid = videoDisplay.querySelector('video')!;
      vid.play().catch(e => log(`[video] play() error: ${e}`));
      log(`[video] lecture lancée: ${src}`);
      break;
    }

    case 'photo': {
      const src = payload.file_src || '';
      if (!src) {
        log('[photo] ERREUR: file_src vide — vérifier convertFileSrc dans App.tsx');
        break;
      }
      imageDisplay.innerHTML = `<img src="${src}" alt="${payload.title || ''}" />`;
      imageDisplay.classList.add('active');
      applyTransition(imageDisplay, payload.transition);
      log(`[photo] image affichée: ${src}`);
      break;
    }

    case 'audio': {
      const src = payload.file_src || '';
      if (!src) {
        log('[audio] ERREUR: file_src vide — vérifier convertFileSrc dans App.tsx');
        break;
      }
      audioTitle.textContent = payload.title || '';
      audioSub.textContent   = payload.duration || '';
      audioEl.src = src;
      audioEl.play().catch(e => log(`[audio] play() error: ${e}`));
      audioDisplay.classList.add('active');
      applyTransition(audioDisplay, payload.transition);
      log(`[audio] lecture lancée: ${src}`);
      break;
    }

    case 'web': {
      // Web: show title/url as text fallback (no iframe for security reasons)
      textDisplay.classList.remove('hidden');
      mainText.textContent = payload.url || payload.title || '';
      refText.textContent  = 'WEB';
      applyTransition(textDisplay, payload.transition);
      log(`[web] url affichée: ${payload.url}`);
      break;
    }

    default: {
      // Text-based: bible, song, slide, pptx, text
      // Guard: if file_src is present but type is unrecognised, show a neutral placeholder
      if (payload.file_src) {
        log(`[default] type="${payload.type}" non géré avec file_src — affichage titre uniquement`);
        textDisplay.classList.remove('hidden');
        mainText.textContent = payload.title || '';
        refText.textContent  = payload.type.toUpperCase();
      } else {
        textDisplay.classList.remove('hidden');
        mainText.textContent = payload.content || payload.title || '';
        refText.textContent  = payload.reference || '';
      }
      applyTransition(textDisplay, payload.transition);
      log(`[text] contenu affiché: "${mainText.textContent.slice(0, 60)}"`);
      break;
    }
  }
}

function showStandby() {
  hideAll();
  standby.classList.remove('hidden');
  stage.style.background = '#000';
}

/* ── Register all listeners first, THEN signal readiness ── */

listen<ProjectionPayload>('projection-update', e => {
  log(`[projection-update] type=${e.payload.type} title="${e.payload.title}"`);
  showContent(e.payload);
});

listen<ProjectionPayload>('projection-sync-content', e => {
  log(`[projection-sync-content] type=${e.payload.type} title="${e.payload.title}"`);
  showContent(e.payload);
});

listen<boolean>('projection-blackout', e => {
  blackout.classList.toggle('active', e.payload);
});

listen<boolean>('projection-logo', e => {
  logoOverlay.classList.toggle('active', e.payload);
});

listen<null>('projection-clear', () => showStandby());

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') blackout.classList.remove('active');
});

showStandby();

/* ── Tell the main window we are ready to receive content ── */
setTimeout(() => {
  log('[projection-ready] fenêtre prête, signal envoyé');
  emit('projection-ready', null).catch(() => {});
}, 100);
