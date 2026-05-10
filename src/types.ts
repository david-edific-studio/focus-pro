export type LibraryTab = 'bible' | 'songs' | 'slides' | 'videos' | 'photos' | 'audio' | 'web' | 'folder';
export type MediaType = 'bible' | 'song' | 'slide' | 'video' | 'photo' | 'audio' | 'web' | 'camera' | 'text' | 'pptx';
export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe' | 'slide';

export interface LibraryItem {
  id: string;
  type: MediaType;
  title: string;
  subtitle?: string;
  content?: string;
  slides?: string[];
  url?: string;
  duration?: string;
  thumbnailColor?: string;
  filePath?: string;
  reference?: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleBook {
  id: string;
  name: string;
  chapters: number;
}

export interface PptxSlide {
  index: number;
  title: string | null;
  content: string[];
  notes: string | null;
  thumbnail_color: string;
}

export interface ProgramItem {
  item: LibraryItem | null;
  slideIndex: number;
  timestamp: number;
}

export interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
  position_x: number;
  position_y: number;
}

export interface AppState {
  preview: ProgramItem;
  program: ProgramItem;
  selectedItem: LibraryItem | null;
  activeCamera: string | null;
  isBlackout: boolean;
  isFreeze: boolean;
  isLogoOn: boolean;
  isMuted: boolean;
  transition: TransitionType;
}
