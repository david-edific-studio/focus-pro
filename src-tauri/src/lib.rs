use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri::Emitter;
use tauri::Listener;

/* ═══════════════════════════════════════════════════════
   DATA STRUCTURES
═══════════════════════════════════════════════════════ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibleVerse {
    pub book: String,
    pub chapter: u32,
    pub verse: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibleBook {
    pub id: String,
    pub name: String,
    pub chapters: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MonitorInfo {
    pub id: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub position_x: i32,
    pub position_y: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PptxSlide {
    pub index: usize,
    pub title: Option<String>,
    pub content: Vec<String>,
    pub notes: Option<String>,
    pub thumbnail_color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
}

/* ═══════════════════════════════════════════════════════
   STATE: last known monitor list (for change detection)
═══════════════════════════════════════════════════════ */
type MonitorState = Arc<Mutex<Vec<MonitorInfo>>>;

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */

fn strip_tags(s: &str) -> String {
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    re.replace_all(s, "").to_string()
}

fn book_id_to_name(id: &str) -> String {
    let map: HashMap<&str, &str> = [
        ("Gen", "Genèse"), ("Exo", "Exode"), ("Lev", "Lévitique"),
        ("Num", "Nombres"), ("Deu", "Deutéronome"), ("Jos", "Josué"),
        ("Jdg", "Juges"), ("Rut", "Ruth"), ("1Sa", "1 Samuel"),
        ("2Sa", "2 Samuel"), ("1Ki", "1 Rois"), ("2Ki", "2 Rois"),
        ("1Ch", "1 Chroniques"), ("2Ch", "2 Chroniques"), ("Ezr", "Esdras"),
        ("Neh", "Néhémie"), ("Est", "Esther"), ("Job", "Job"),
        ("Psa", "Psaumes"), ("Pro", "Proverbes"), ("Ecc", "Ecclésiaste"),
        ("Son", "Cantique des Cantiques"), ("Isa", "Ésaïe"), ("Jer", "Jérémie"),
        ("Lam", "Lamentations"), ("Eze", "Ézéchiel"), ("Dan", "Daniel"),
        ("Hos", "Osée"), ("Joe", "Joël"), ("Amo", "Amos"), ("Oba", "Abdias"),
        ("Jon", "Jonas"), ("Mic", "Michée"), ("Nah", "Nahoum"),
        ("Hab", "Habacuc"), ("Zep", "Sophonie"), ("Hag", "Aggée"),
        ("Zec", "Zacharie"), ("Mal", "Malachie"),
        ("Mat", "Matthieu"), ("Mar", "Marc"), ("Luk", "Luc"), ("Joh", "Jean"),
        ("Act", "Actes"), ("Rom", "Romains"), ("1Co", "1 Corinthiens"),
        ("2Co", "2 Corinthiens"), ("Gal", "Galates"), ("Eph", "Éphésiens"),
        ("Php", "Philippiens"), ("Col", "Colossiens"), ("1Th", "1 Thessaloniciens"),
        ("2Th", "2 Thessaloniciens"), ("1Ti", "1 Timothée"), ("2Ti", "2 Timothée"),
        ("Tit", "Tite"), ("Phm", "Philémon"), ("Heb", "Hébreux"),
        ("Jas", "Jacques"), ("1Pe", "1 Pierre"), ("2Pe", "2 Pierre"),
        ("1Jo", "1 Jean"), ("2Jo", "2 Jean"), ("3Jo", "3 Jean"),
        ("Jud", "Jude"), ("Rev", "Apocalypse"),
    ].iter().cloned().collect();
    map.get(id).map(|s| s.to_string()).unwrap_or_else(|| id.to_string())
}

fn collect_monitors(app: &tauri::AppHandle) -> Vec<MonitorInfo> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(i, m)| {
            let pos  = m.position();
            let size = m.size();
            MonitorInfo {
                id: i,
                name: format!("Écran {} — {}×{}", i + 1, size.width, size.height),
                width: size.width,
                height: size.height,
                is_primary: i == 0,
                position_x: pos.x,
                position_y: pos.y,
            }
        })
        .collect()
}

/* ═══════════════════════════════════════════════════════
   BIBLE COMMANDS
═══════════════════════════════════════════════════════ */

#[tauri::command]
async fn load_bible_csv(path: String) -> Result<Vec<BibleVerse>, String> {
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .has_headers(true)
        .from_path(&path)
        .map_err(|e| format!("Erreur lecture CSV: {}", e))?;

    let mut verses = Vec::new();
    for result in rdr.records() {
        let record = result.map_err(|e| format!("Erreur ligne CSV: {}", e))?;
        if record.len() < 4 { continue; }
        let book     = record[0].trim().to_string();
        let chapter: u32 = record[1].trim().parse().unwrap_or(0);
        let verse: u32   = record[2].trim().parse().unwrap_or(0);
        let text = strip_tags(record[3].trim());
        if !book.is_empty() && chapter > 0 && verse > 0 {
            verses.push(BibleVerse { book, chapter, verse, text });
        }
    }
    Ok(verses)
}

#[tauri::command]
async fn load_bible_osis_xml(path: String) -> Result<Vec<BibleVerse>, String> {
    use quick_xml::Reader;
    use quick_xml::events::Event;

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Erreur lecture XML: {}", e))?;

    let mut verses = Vec::new();
    let mut current_book = String::new();
    let mut current_chapter: u32 = 0;
    let mut current_verse_num: u32 = 0;
    let mut current_text = String::new();
    let mut in_verse = false;

    let mut reader = Reader::from_str(&content);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = std::str::from_utf8(e.name().as_ref()).unwrap_or("").to_string();
                match name.as_str() {
                    "div" => {
                        for attr in e.attributes().flatten() {
                            let k = std::str::from_utf8(attr.key.as_ref()).unwrap_or("").to_string();
                            let v = attr.unescape_value().unwrap_or_default().to_string();
                            if k == "osisID" && !v.contains('.') {
                                current_book = v;
                                current_chapter = 0;
                            }
                        }
                    }
                    "chapter" => {
                        for attr in e.attributes().flatten() {
                            let k = std::str::from_utf8(attr.key.as_ref()).unwrap_or("").to_string();
                            let v = attr.unescape_value().unwrap_or_default().to_string();
                            if k == "osisID" {
                                if let Some(ch) = v.split('.').nth(1) {
                                    current_chapter = ch.parse().unwrap_or(0);
                                }
                            }
                            if k == "n" {
                                current_chapter = v.parse().unwrap_or(current_chapter);
                            }
                        }
                        in_verse = false;
                    }
                    "verse" => {
                        if in_verse && !current_text.trim().is_empty() {
                            verses.push(BibleVerse {
                                book: current_book.clone(),
                                chapter: current_chapter,
                                verse: current_verse_num,
                                text: current_text.trim().to_string(),
                            });
                        }
                        current_text = String::new();
                        in_verse = true;
                        for attr in e.attributes().flatten() {
                            let k = std::str::from_utf8(attr.key.as_ref()).unwrap_or("").to_string();
                            let v = attr.unescape_value().unwrap_or_default().to_string();
                            if k == "osisID" {
                                let parts: Vec<&str> = v.split('.').collect();
                                if parts.len() >= 3 {
                                    current_book   = parts[0].to_string();
                                    current_chapter = parts[1].parse().unwrap_or(current_chapter);
                                    current_verse_num = parts[2].parse().unwrap_or(0);
                                }
                            }
                            if k == "n" {
                                current_verse_num = v.parse().unwrap_or(current_verse_num);
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                if in_verse {
                    if let Ok(t) = e.unescape() {
                        current_text.push_str(&t);
                        current_text.push(' ');
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name_bytes = e.name();
                let name = std::str::from_utf8(name_bytes.as_ref()).unwrap_or("");
                if name == "verse" && in_verse && !current_text.trim().is_empty() {
                    verses.push(BibleVerse {
                        book: current_book.clone(),
                        chapter: current_chapter,
                        verse: current_verse_num,
                        text: current_text.trim().to_string(),
                    });
                    current_text = String::new();
                    in_verse = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    Ok(verses)
}

#[tauri::command]
async fn get_bible_books(verses: Vec<BibleVerse>) -> Vec<BibleBook> {
    let mut book_chapters: HashMap<String, u32> = HashMap::new();
    for v in &verses {
        let entry = book_chapters.entry(v.book.clone()).or_insert(0);
        if v.chapter > *entry { *entry = v.chapter; }
    }
    let order = vec![
        "Gen","Exo","Lev","Num","Deu","Jos","Jdg","Rut","1Sa","2Sa",
        "1Ki","2Ki","1Ch","2Ch","Ezr","Neh","Est","Job","Psa","Pro",
        "Ecc","Son","Isa","Jer","Lam","Eze","Dan","Hos","Joe","Amo",
        "Oba","Jon","Mic","Nah","Hab","Zep","Hag","Zec","Mal",
        "Mat","Mar","Luk","Joh","Act","Rom","1Co","2Co","Gal","Eph",
        "Php","Col","1Th","2Th","1Ti","2Ti","Tit","Phm","Heb",
        "Jas","1Pe","2Pe","1Jo","2Jo","3Jo","Jud","Rev",
    ];
    let mut books: Vec<BibleBook> = book_chapters.into_iter().map(|(id, chapters)| {
        let name = book_id_to_name(&id);
        BibleBook { id, name, chapters }
    }).collect();
    books.sort_by_key(|b| order.iter().position(|&x| x == b.id).unwrap_or(999));
    books
}

#[tauri::command]
async fn search_bible(verses: Vec<BibleVerse>, query: String) -> Vec<BibleVerse> {
    let q = query.to_lowercase();
    verses.into_iter().filter(|v| v.text.to_lowercase().contains(&q)).take(200).collect()
}

/* ═══════════════════════════════════════════════════════
   PPTX COMMAND
═══════════════════════════════════════════════════════ */

#[tauri::command]
async fn load_pptx(path: String) -> Result<Vec<PptxSlide>, String> {
    use std::io::Read;
    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Impossible d'ouvrir le fichier: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Fichier PPTX invalide: {}", e))?;

    let mut slide_xmls: Vec<(usize, String)> = Vec::new();
    for i in 0..archive.len() {
        let mut f = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = f.name().to_string();
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") && !name.contains("_rels") {
            let n: usize = name
                .trim_start_matches("ppt/slides/slide")
                .trim_end_matches(".xml")
                .parse()
                .unwrap_or(0);
            let mut content = String::new();
            f.read_to_string(&mut content).map_err(|e| e.to_string())?;
            slide_xmls.push((n, content));
        }
    }
    slide_xmls.sort_by_key(|(n, _)| *n);

    let colors = ["#0a0a14","#0a1008","#14080a","#0a0814","#0a1210","#140a08"];
    let slides = slide_xmls.into_iter().enumerate().map(|(idx, (_, xml))| {
        let texts = extract_pptx_texts(&xml);
        let title = texts.first().cloned();
        let content = texts;
        PptxSlide { index: idx, title, content, notes: None, thumbnail_color: colors[idx % colors.len()].to_string() }
    }).collect();
    Ok(slides)
}

fn extract_pptx_texts(xml: &str) -> Vec<String> {
    let re      = regex::Regex::new(r"<a:t[^>]*>([^<]+)</a:t>").unwrap();
    let para_re = regex::Regex::new(r"(?s)<a:p[^>]*>(.*?)</a:p>").unwrap();
    let mut texts = Vec::new();
    for cap in para_re.captures_iter(xml) {
        let para = &cap[1];
        let mut line = String::new();
        for t in re.captures_iter(para) { line.push_str(&t[1]); }
        let trimmed = line.trim().to_string();
        if !trimmed.is_empty() { texts.push(trimmed); }
    }
    texts
}

/* ═══════════════════════════════════════════════════════
   FILE INFO
═══════════════════════════════════════════════════════ */

#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p    = std::path::Path::new(&path);
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(FileInfo {
        path:      path.clone(),
        name:      p.file_name().unwrap_or_default().to_str().unwrap_or("").to_string(),
        extension: p.extension().unwrap_or_default().to_str().unwrap_or("").to_lowercase(),
        size:      meta.len(),
    })
}

/* ═══════════════════════════════════════════════════════
   MONITOR COMMANDS
═══════════════════════════════════════════════════════ */

/// Returns the current list of connected monitors.
/// Called on startup and whenever the frontend wants a refresh.
#[tauri::command]
async fn get_monitors(app: tauri::AppHandle) -> Vec<MonitorInfo> {
    collect_monitors(&app)
}

/// Opens (or moves) the projection window to the chosen monitor.
/// Works on both X11 and Wayland by:
///   1. Creating the window at the target monitor's position (no fullscreen yet)
///   2. Explicitly calling set_position / set_size after creation
///   3. Then calling set_fullscreen(true) so the compositor places it correctly
#[tauri::command]
async fn open_projection_window(app: tauri::AppHandle, monitor_id: usize) -> Result<(), String> {
    let monitors = app.available_monitors().unwrap_or_default();
    let monitor  = monitors.get(monitor_id).ok_or_else(|| "Moniteur introuvable".to_string())?;

    // Capture position & size as plain integers before the monitor reference is dropped
    let pos_x  = monitor.position().x;
    let pos_y  = monitor.position().y;
    let width  = monitor.size().width;
    let height = monitor.size().height;

    // If window already exists: move it to the new monitor and re-fullscreen
    if let Some(window) = app.get_webview_window("projection") {
        let _ = window.set_fullscreen(false);
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = window.set_fullscreen(true);
        let _ = window.set_focus();
        return Ok(());
    }

    // Create the window positioned at the target monitor — NO fullscreen flag yet
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "projection",
        tauri::WebviewUrl::App("projection.html".into()),
    )
    .title("Focus Pro — Projection")
    .position(pos_x as f64, pos_y as f64)
    .inner_size(width as f64, height as f64)
    .decorations(false)
    .always_on_top(true)
    // fullscreen intentionally omitted here — set below after the window is placed
    .build()
    .map_err(|e| format!("Erreur création fenêtre: {}", e))?;

    // Give the compositor time to place the window at pos before going fullscreen
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Reconfirm position (needed on some Wayland compositors)
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));

    std::thread::sleep(std::time::Duration::from_millis(80));

    // Now go fullscreen — the compositor will fullscreen it on the monitor it's already on
    let _ = window.set_fullscreen(true);

    Ok(())
}

/// Sends the current PROGRAM content to the projection window.
/// event_name lets the caller choose between "projection-update" (normal push)
/// and "projection-sync-content" (initial sync on ready).
#[tauri::command]
async fn send_to_projection(
    app: tauri::AppHandle,
    payload: serde_json::Value,
    event_name: Option<String>,
) -> Result<(), String> {
    let ev = event_name.as_deref().unwrap_or("projection-update");
    match app.get_webview_window("projection") {
        Some(win) => win.emit(ev, &payload).map_err(|e| e.to_string()),
        None      => Err("Aucune fenêtre de projection ouverte".to_string()),
    }
}

/// Sends a BLACKOUT signal to the projection window.
#[tauri::command]
async fn send_blackout(app: tauri::AppHandle, active: bool) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("projection") {
        win.emit("projection-blackout", active).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Closes the projection window.
#[tauri::command]
async fn close_projection_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("projection") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Returns true if a projection window is currently open.
#[tauri::command]
async fn projection_is_open(app: tauri::AppHandle) -> bool {
    app.get_webview_window("projection").is_some()
}

/* ═══════════════════════════════════════════════════════
   MONITOR HOT-PLUG POLLING
   Polls every 2 s; if the list changes, emits "monitors-changed"
   to the main window so the frontend refreshes automatically.
═══════════════════════════════════════════════════════ */

fn start_monitor_watcher(app: tauri::AppHandle, state: MonitorState) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let current = collect_monitors(&app);
            let mut last = state.lock().unwrap();
            if *last != current {
                *last = current.clone();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.emit("monitors-changed", &current);
                }
            }
        }
    });
}

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
═══════════════════════════════════════════════════════ */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let monitor_state: MonitorState = Arc::new(Mutex::new(Vec::new()));
    let monitor_state_clone = monitor_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            load_bible_csv,
            load_bible_osis_xml,
            get_bible_books,
            search_bible,
            load_pptx,
            get_file_info,
            get_monitors,
            open_projection_window,
            send_to_projection,
            send_blackout,
            close_projection_window,
            projection_is_open,
        ])
        .setup(move |app| {
            // Seed the monitor state
            let initial = collect_monitors(app.handle());
            *monitor_state_clone.lock().unwrap() = initial;
            // Start hot-plug watcher
            start_monitor_watcher(app.handle().clone(), monitor_state_clone.clone());

            // When the projection window signals it is ready, forward the event
            // to the main window so App.tsx can send the current PROGRAM content.
            let app_handle = app.handle().clone();
            app.handle().listen("projection-ready", move |_event| {
                if let Some(main_win) = app_handle.get_webview_window("main") {
                    let _ = main_win.emit("projection-needs-sync", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de Focus Pro");
}
