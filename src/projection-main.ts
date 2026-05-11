import { listen, emit } from '@tauri-apps/api/event';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

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
  file_path?: string;
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
  const oldVideo = videoDisplay.querySelector('video');
  if (oldVideo) { oldVideo.pause(); oldVideo.src = ''; }
  audioEl.pause();
  audioEl.src = '';
}

function applyTransition(el: HTMLElement, transition = 'fade') {
  el.className = el.className.replace(/transition-\S+/g, '').trim();
  void el.offsetWidth;
  el.classList.add(`transition-${transition}`);
}

function showContent(payload: ProjectionPayload) {
  standby.classList.add('hidden');
  hideAll();
  stage.style.background = '#000';

  // Convert the raw file path to an asset:// URL in THIS webview's context
  const assetSrc = payload.file_path ? convertFileSrc(payload.file_path) : '';

  log(`[showContent] type=${payload.type} file_path="${payload.file_path}" assetSrc="${assetSrc}"`);

  switch (payload.type) {

    case 'video': {
      if (!assetSrc) {
        log('[video] ERREUR: file_path vide');
        break;
      }
      videoDisplay.innerHTML = `<video autoplay loop playsinline src="${assetSrc}"></video>`;
      videoDisplay.classList.add('active');
      applyTransition(videoDisplay, payload.transition);
      videoDisplay.querySelector('video')!.play().catch(e => log(`[video] play() error: ${e}`));
      log(`[video] lecture lancée: ${assetSrc}`);
      break;
    }

    case 'photo': {
      if (!assetSrc) {
        log('[photo] ERREUR: file_path vide');
        break;
      }
      imageDisplay.innerHTML = `<img src="${assetSrc}" alt="${payload.title || ''}" />`;
      imageDisplay.classList.add('active');
      applyTransition(imageDisplay, payload.transition);
      log(`[photo] image affichée: ${assetSrc}`);
      break;
    }

    case 'audio': {
      if (!assetSrc) {
        log('[audio] ERREUR: file_path vide');
        break;
      }
      audioTitle.textContent = payload.title || '';
      audioSub.textContent   = payload.duration || '';
      audioEl.src = assetSrc;
      audioEl.play().catch(e => log(`[audio] play() error: ${e}`));
      audioDisplay.classList.add('active');
      applyTransition(audioDisplay, payload.transition);
      log(`[audio] lecture lancée: ${assetSrc}`);
      break;
    }

    case 'web': {
      textDisplay.classList.remove('hidden');
      mainText.textContent = payload.url || payload.title || '';
      refText.textContent  = 'WEB';
      applyTransition(textDisplay, payload.transition);
      log(`[web] url affichée: ${payload.url}`);
      break;
    }

    default: {
      textDisplay.classList.remove('hidden');
      mainText.textContent = payload.content || payload.title || '';
      refText.textContent  = payload.reference || '';
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

setTimeout(() => {
  log('[projection-ready] fenêtre prête, signal envoyé');
  emit('projection-ready', null).catch(() => {});
}, 100);
