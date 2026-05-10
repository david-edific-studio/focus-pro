import { useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  BookOpen, Music, Image, Film, Volume2, Globe, FolderOpen,
  Layers, ChevronRight, Search, Plus, Upload, Loader
} from 'lucide-react';
import type { LibraryItem, LibraryTab, BibleVerse, BibleBook, PptxSlide } from '../types';

/* ─── STATIC DATA ─── */
const SONGS: LibraryItem[] = [
  { id: 's1', type: 'song', title: 'Grand est ton Amour', subtitle: '4/4 · Louange', slides: ['Grand est ton amour\nÉternel et fidèle', 'Tu es mon rocher\nMa force et mon bouclier', 'Refrain: Gloire à Dieu\nDans les hauteurs', 'Gloire à Dieu\nDans les hauteurs', 'Pont: Hosanna\nHosanna au Seigneur'] },
  { id: 's2', type: 'song', title: 'Hosanna au plus haut', subtitle: '6/8 · Adoration', slides: ['Hosanna au plus haut des cieux', 'Tu règnes sur toute la terre', 'Refrain: Loue, loue son nom', 'Pont: Digne est l\'Agneau', 'Final: Amen, Amen'] },
  { id: 's3', type: 'song', title: 'Je loue ton nom', subtitle: '4/4 · Cantique', slides: ['Je loue ton nom Seigneur', 'Tu es digne d\'être adoré', 'Refrain: Alléluia', 'Pont: Tu es saint, tu es saint'] },
  { id: 's4', type: 'song', title: 'Tu es digne', subtitle: '4/4 · Louange', slides: ['Tu es digne d\'être loué', 'Ta gloire remplit la terre', 'Refrain: Gloire, honneur et puissance', 'Final: Pour toujours'] },
  { id: 's5', type: 'song', title: 'Alléluia (Choral)', subtitle: 'Liturgique', slides: ['Alléluia', 'Gloire à Dieu', 'Loué soit son nom', 'Alléluia, Alléluia'] },
];

const SLIDES_STATIC: LibraryItem[] = [
  { id: 'sl1', type: 'slide', title: 'Annonces Dimanche', subtitle: '5 diapositives', slides: ['Bienvenue !', 'Culte principal 10h30', 'École du Dimanche 9h00', 'Jeûne & Prière Vendredi', 'Prière Mercredi 19h00'] },
  { id: 'sl2', type: 'slide', title: 'Programme Hebdo', subtitle: '7 diapositives', slides: ['Lundi — Prière intercession', 'Mardi — Maison de la Bible', 'Mercredi — Jeunes 19h', 'Jeudi — Rencontre Femmes', 'Vendredi — Jeûne', 'Samedi — Chorale', 'Dimanche — Culte 10h30'] },
  { id: 'sl3', type: 'slide', title: 'Message Pastoral', subtitle: '3 diapositives', slides: ['La Foi en Action', 'Hébreux 11:1 — Or la foi…', '"La foi sans les œuvres est morte"'] },
];

const VIDEOS_STATIC: LibraryItem[] = [
  { id: 'v1', type: 'video', title: 'Intro Service', subtitle: '0:45 · MP4', duration: '0:45' },
  { id: 'v2', type: 'video', title: 'Témoignage Frère Paul', subtitle: '5:20 · MP4', duration: '5:20' },
  { id: 'v3', type: 'video', title: 'Clips Louange Mix', subtitle: '8:33 · MP4', duration: '8:33' },
];

const PHOTOS_STATIC: LibraryItem[] = [
  { id: 'p1', type: 'photo', title: 'Fond Croix Dorée', subtitle: 'JPG · 1920×1080', thumbnailColor: '#1a1000' },
  { id: 'p2', type: 'photo', title: 'Fond Ciel Nuages', subtitle: 'JPG · 1920×1080', thumbnailColor: '#0a0a1a' },
  { id: 'p3', type: 'photo', title: 'Logo Église', subtitle: 'PNG · Transparent', thumbnailColor: '#000a0a' },
];

const AUDIO_STATIC: LibraryItem[] = [
  { id: 'a1', type: 'audio', title: 'Musique d\'Entrée', subtitle: '3:24 · MP3', duration: '3:24' },
  { id: 'a2', type: 'audio', title: 'Fond Instrumental Prière', subtitle: '10:00 · MP3', duration: '10:00' },
  { id: 'a3', type: 'audio', title: 'Son Ambiance', subtitle: 'Loop · WAV', duration: 'Loop' },
];

const WEB_STATIC: LibraryItem[] = [
  { id: 'w1', type: 'web', title: 'Site Église', subtitle: 'eglise.fr', url: 'https://eglise.fr' },
  { id: 'w2', type: 'web', title: 'Bible en Ligne', subtitle: 'bible.com', url: 'https://www.bible.com' },
  { id: 'w3', type: 'web', title: 'YouTube Live', subtitle: 'youtube.com/live', url: 'https://youtube.com' },
];

const TABS: { id: LibraryTab; label: string; icon: React.ReactNode }[] = [
  { id: 'bible', label: 'Bible', icon: <BookOpen size={11} /> },
  { id: 'songs', label: 'Chants', icon: <Music size={11} /> },
  { id: 'slides', label: 'Slides', icon: <Layers size={11} /> },
  { id: 'videos', label: 'Vidéo', icon: <Film size={11} /> },
  { id: 'photos', label: 'Photo', icon: <Image size={11} /> },
  { id: 'audio', label: 'Audio', icon: <Volume2 size={11} /> },
  { id: 'web', label: 'Web', icon: <Globe size={11} /> },
  { id: 'folder', label: 'Fichiers', icon: <FolderOpen size={11} /> },
];

const TYPE_ICON: Record<string, string> = { bible: '📖', song: '🎵', slide: '🖼', video: '🎬', photo: '📷', audio: '🎧', web: '🌐', camera: '📹', text: '📝', pptx: '📊' };
const TYPE_TAG: Record<string, string> = { bible: 'tag-bible', song: 'tag-song', slide: 'tag-media', video: 'tag-media', photo: 'tag-media', audio: 'tag-song', web: 'tag-web', pptx: 'tag-pptx', camera: 'tag-live', text: 'tag-bible' };

/* ─── BIBLE BROWSER SUB-COMPONENT ─── */
function BibleBrowser({ onSelectItem }: { onSelectItem: (item: LibraryItem) => void }) {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selBook, setSelBook] = useState('');
  const [selChapter, setSelChapter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<BibleVerse[]>([]);
  const [searching, setSearching] = useState(false);

  const loadBible = async () => {
    const path = await open({ filters: [{ name: 'Bible', extensions: ['csv', 'xml'] }] });
    if (!path || typeof path !== 'string') return;
    setLoading(true);
    setError(null);
    try {
      let loaded: BibleVerse[];
      if (path.endsWith('.xml')) {
        loaded = await invoke<BibleVerse[]>('load_bible_osis_xml', { path });
      } else {
        loaded = await invoke<BibleVerse[]>('load_bible_csv', { path });
      }
      setVerses(loaded);
      const bks = await invoke<BibleBook[]>('get_bible_books', { verses: loaded });
      setBooks(bks);
      if (bks.length > 0) { setSelBook(bks[0].id); setSelChapter(1); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const doSearch = useCallback(async () => {
    if (!searchQ.trim() || verses.length === 0) return;
    setSearching(true);
    try {
      const res = await invoke<BibleVerse[]>('search_bible', { verses, query: searchQ });
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  }, [searchQ, verses]);

  const currentBook = books.find(b => b.id === selBook);
  const chapters = currentBook ? Array.from({ length: currentBook.chapters }, (_, i) => i + 1) : [];

  const displayVerses = useMemo(() => {
    if (searchResults.length > 0 && searchQ) return searchResults;
    if (!selBook) return [];
    return verses.filter(v => v.book === selBook && v.chapter === selChapter);
  }, [verses, selBook, selChapter, searchResults, searchQ]);

  const toItem = (v: BibleVerse): LibraryItem => ({
    id: `bible-${v.book}-${v.chapter}-${v.verse}`,
    type: 'bible',
    title: `${books.find(b => b.id === v.book)?.name || v.book} ${v.chapter}:${v.verse}`,
    subtitle: v.book,
    content: v.text,
    reference: `${books.find(b => b.id === v.book)?.name || v.book} ${v.chapter}:${v.verse}`,
  });

  if (verses.length === 0) {
    return (
      <div className="bible-browser" style={{ justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 36 }}>📖</span>
        <div style={{ fontSize: 9, color: 'var(--tx-3)', fontFamily: 'var(--mono)', textAlign: 'center', letterSpacing: 1 }}>
          Aucune Bible chargée
        </div>
        <button className="bible-load-btn" onClick={loadBible} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Upload size={10} style={{ display: 'inline', marginRight: 4 }} />}
          Charger CSV / XML OSIS
        </button>
        {error && <div style={{ fontSize: 8, color: 'var(--red)', fontFamily: 'var(--mono)', padding: '0 8px', textAlign: 'center' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className="bible-browser">
      {/* Book + chapter selectors */}
      <div className="bible-selectors">
        <select className="fp-select" value={selBook} onChange={e => { setSelBook(e.target.value); setSelChapter(1); setSearchQ(''); setSearchResults([]); }}>
          {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="fp-select" style={{ maxWidth: 56 }} value={selChapter} onChange={e => { setSelChapter(Number(e.target.value)); setSearchQ(''); setSearchResults([]); }}>
          {chapters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="bible-load-btn" onClick={loadBible} title="Changer de fichier Bible">↺</button>
      </div>

      {/* Search */}
      <div className="lib-search">
        <div className="lib-search-wrap" style={{ display: 'flex', gap: 4 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={10} className="lib-search-ico" />
            <input
              className="lib-search-input"
              placeholder="Rechercher un verset…"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); if (!e.target.value) setSearchResults([]); }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
          </div>
          <button className="bible-load-btn" onClick={doSearch} disabled={searching} style={{ padding: '5px 8px' }}>
            {searching ? <span className="spinner" style={{ width: 10, height: 10 }} /> : <Search size={10} />}
          </button>
        </div>
      </div>

      {/* Verse list */}
      <div className="lib-list">
        {displayVerses.map(v => {
          const item = toItem(v);
          return (
            <div key={item.id} className="lib-item" onClick={() => onSelectItem(item)} onDoubleClick={() => onSelectItem(item)}>
              <div style={{ width: 22, height: 22, background: 'var(--blue-dim)', borderRadius: 'var(--r-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#60a5fa', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                {v.verse}
              </div>
              <div className="lib-item-body">
                <div className="lib-item-title" style={{ fontSize: 9, lineHeight: 1.3, whiteSpace: 'normal', overflow: 'hidden', maxHeight: 30 }}>{v.text.slice(0, 80)}{v.text.length > 80 ? '…' : ''}</div>
                <div className="lib-item-sub">{books.find(b => b.id === v.book)?.name} {v.chapter}:{v.verse}</div>
              </div>
              <button className="lib-item-push" onClick={e => { e.stopPropagation(); onSelectItem(item); }}>
                <ChevronRight size={9} />
              </button>
            </div>
          );
        })}
        {displayVerses.length === 0 && (
          <div className="empty-state">Aucun verset trouvé</div>
        )}
      </div>
    </div>
  );
}

/* ─── PPTX LOADER ─── */
function PptxSection({ items, onAdd }: { items: LibraryItem[]; onAdd: (item: LibraryItem) => void }) {
  const [loading, setLoading] = useState(false);

  const loadPptx = async () => {
    const path = await open({ filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppt'] }] });
    if (!path || typeof path !== 'string') return;
    setLoading(true);
    try {
      const slides = await invoke<PptxSlide[]>('load_pptx', { path });
      const name = path.split('/').pop()?.replace(/\.(pptx?)/i, '') || 'Présentation';
      const item: LibraryItem = {
        id: `pptx-${Date.now()}`,
        type: 'pptx',
        title: name,
        subtitle: `${slides.length} diapositives · PPTX`,
        slides: slides.map(s => s.content.join('\n') || s.title || `Diapo ${s.index + 1}`),
        filePath: path,
      };
      onAdd(item);
    } catch (e) {
      alert(`Erreur PPTX: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ padding: '6px 6px 0' }}>
        <button className="bible-load-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px' }} onClick={loadPptx} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Upload size={10} />}
          Ouvrir un fichier PPTX
        </button>
      </div>
      {items.map(item => (
        <div key={item.id} className="lib-item" onClick={() => onAdd(item)}>
          <div className="lib-item-ico">📊</div>
          <div className="lib-item-body">
            <div className="lib-item-title">{item.title}</div>
            <div className="lib-item-sub">{item.subtitle}</div>
          </div>
          <button className="lib-item-push" onClick={e => { e.stopPropagation(); onAdd(item); }}><ChevronRight size={9} /></button>
        </div>
      ))}
    </>
  );
}

/* ─── FOLDER BROWSER ─── */
function FolderSection({ onAdd }: { onAdd: (item: LibraryItem) => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const openFile = async (ext: string[], type: string, label: string) => {
    setLoading(type);
    try {
      const path = await open({ filters: [{ name: label, extensions: ext }], multiple: true });
      const paths = Array.isArray(path) ? path : path ? [path] : [];
      for (const p of paths) {
        const name = p.split('/').pop() || p;
        const item: LibraryItem = { id: `file-${Date.now()}-${Math.random()}`, type: type as any, title: name, subtitle: p.split('/').pop(), filePath: p };
        onAdd(item);
      }
    } finally {
      setLoading(null);
    }
  };

  const entries = [
    { label: 'Vidéo', icon: '🎬', ext: ['mp4', 'mkv', 'avi', 'mov', 'webm'], type: 'video' },
    { label: 'Photo / Image', icon: '🖼', ext: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], type: 'photo' },
    { label: 'Audio', icon: '🎧', ext: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'], type: 'audio' },
    { label: 'PowerPoint', icon: '📊', ext: ['pptx', 'ppt'], type: 'pptx' },
    { label: 'Tous les fichiers', icon: '📂', ext: ['*'], type: 'text' },
  ];

  return (
    <div className="folder-grid">
      <div className="lib-sec">Ouvrir des fichiers</div>
      {entries.map(e => (
        <div key={e.type} className="folder-item" onClick={() => openFile(e.ext, e.type, e.label)}>
          <span>{e.icon}</span>
          <span>{e.label}</span>
          {loading === e.type && <span className="spinner" style={{ width: 11, height: 11, marginLeft: 'auto' }} />}
        </div>
      ))}
    </div>
  );
}

/* ─── MAIN LIBRARY PANEL ─── */
interface Props {
  selectedItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
  onPushToPreview: (item: LibraryItem) => void;
}

export function LibraryPanel({ selectedItem, onSelect, onPushToPreview }: Props) {
  const [tab, setTab] = useState<LibraryTab>('bible');
  const [search, setSearch] = useState('');
  const [pptxItems, setPptxItems] = useState<LibraryItem[]>([]);
  const [dynamicItems, setDynamicItems] = useState<LibraryItem[]>([]);

  const staticData: Record<LibraryTab, LibraryItem[]> = {
    bible: [],
    songs: SONGS,
    slides: SLIDES_STATIC,
    videos: VIDEOS_STATIC,
    photos: PHOTOS_STATIC,
    audio: AUDIO_STATIC,
    web: WEB_STATIC,
    folder: [],
  };

  const items = useMemo(() => {
    const base = [...(staticData[tab] || []), ...dynamicItems.filter(d => d.type === tab || (tab === 'slides' && d.type === 'pptx'))];
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(i => i.title.toLowerCase().includes(q) || i.subtitle?.toLowerCase().includes(q));
  }, [tab, search, dynamicItems]);

  return (
    <div className="panel lib-panel">
      <div className="ph">
        <span className="ph-title">Bibliothèque</span>
        <div className="ph-right">
          <button className="ph-btn" title="Nouveau"><Plus size={10} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="lib-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`lib-tab${tab === t.id ? ' on' : ''}`} onClick={() => { setTab(t.id); setSearch(''); }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Bible browser */}
      {tab === 'bible' ? (
        <BibleBrowser onSelectItem={item => { onSelect(item); onPushToPreview(item); }} />
      ) : tab === 'folder' ? (
        <div className="lib-list" style={{ overflowY: 'auto' }}>
          <FolderSection onAdd={item => { setDynamicItems(p => [...p, item]); onPushToPreview(item); }} />
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="lib-search">
            <div className="lib-search-wrap">
              <Search size={10} className="lib-search-ico" />
              <input className="lib-search-input" placeholder={`Rechercher…`} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="lib-list">
            {tab === 'slides' && <PptxSection items={pptxItems} onAdd={item => { setPptxItems(p => [...p, item]); onPushToPreview(item); }} />}

            {items.length === 0 && <div className="empty-state"><Loader size={14} />Aucun résultat</div>}

            {items.map(item => (
              <div key={item.id} className={`lib-item${selectedItem?.id === item.id ? ' sel' : ''}`}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onPushToPreview(item)}
              >
                <div className="lib-item-ico">{TYPE_ICON[item.type] || '📄'}</div>
                <div className="lib-item-body">
                  <div className="lib-item-title">{item.title}</div>
                  <div className="lib-item-sub">
                    <span className={`tag ${TYPE_TAG[item.type] || 'tag-media'}`}>{item.type}</span>
                    {item.subtitle && <span style={{ marginLeft: 4 }}>{item.subtitle}</span>}
                  </div>
                </div>
                <button className="lib-item-push" onClick={e => { e.stopPropagation(); onPushToPreview(item); }}>
                  <ChevronRight size={9} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Selected footer */}
      {selectedItem && tab !== 'bible' && (
        <div className="lib-footer">
          <div className="lib-footer-name">{selectedItem.title}</div>
          <button className="btn-push-full" onClick={() => onPushToPreview(selectedItem)}>
            <ChevronRight size={10} /> Push Preview
          </button>
        </div>
      )}
    </div>
  );
}
