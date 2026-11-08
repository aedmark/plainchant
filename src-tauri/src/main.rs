#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, State};

/// Paths the writer chose in a native dialog (D-070, P8-13). `read_script_file` and `write_script_file` only touch a
/// path in this set, so a script in the page cannot ask for an arbitrary file. Exact matches only: the strings are the
/// ones this file handed back from a dialog. The set is kept in the app data directory so a linked file survives a
/// restart; only Rust writes that file.
#[derive(Default)]
struct Allowed(Mutex<HashSet<PathBuf>>);

const ALLOWED_FILE: &str = "linked-paths.json";
const NOT_CHOSEN: &str = "not chosen: that file must be picked again in a dialog";

fn allowed_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(ALLOWED_FILE))
}

fn load_allowed(app: &AppHandle) -> HashSet<PathBuf> {
    allowed_file(app)
        .and_then(|f| fs::read(f).ok())
        .and_then(|b| serde_json::from_slice::<Vec<String>>(&b).ok())
        .map(|v| v.into_iter().map(PathBuf::from).collect())
        .unwrap_or_default()
}

fn allow(app: &AppHandle, state: &State<Allowed>, path: &Path) {
    let mut set = state.0.lock().unwrap();
    if !set.insert(path.to_path_buf()) {
        return;
    }
    if let Some(file) = allowed_file(app) {
        if let Some(dir) = file.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let list: Vec<String> = set.iter().map(|p| p.to_string_lossy().into_owned()).collect();
        if let Ok(json) = serde_json::to_vec(&list) {
            let _ = fs::write(file, json);
        }
    }
}

fn permitted(set: &HashSet<PathBuf>, path: &str) -> Result<PathBuf, String> {
    let wanted = PathBuf::from(path);
    if set.contains(&wanted) {
        Ok(wanted)
    } else {
        Err(NOT_CHOSEN.to_string())
    }
}

#[derive(Serialize)]
struct ScriptFilePayload {
    path: String,
    name: String,
    bytes: Vec<u8>,
    modified: u64,
}

#[derive(Serialize)]
struct ScriptPathPayload {
    path: String,
    name: String,
}

fn file_modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn file_name_string(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn read_payload(path: PathBuf) -> Result<ScriptFilePayload, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let modified = file_modified_ms(&path);
    let name = file_name_string(&path);
    Ok(ScriptFilePayload {
        path: path.to_string_lossy().into_owned(),
        name,
        bytes,
        modified,
    })
}

#[tauri::command]
fn pick_open_script(app: AppHandle, state: State<Allowed>) -> Result<Option<ScriptFilePayload>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Open Fountain Screenplay")
        .add_filter("Fountain screenplay", &["fountain", "txt", "md"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    allow(&app, &state, &path);
    read_payload(path).map(Some)
}

#[tauri::command]
fn pick_save_script(
    app: AppHandle,
    state: State<Allowed>,
    suggested_name: String,
) -> Result<Option<ScriptPathPayload>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Sync Screenplay with File")
        .set_file_name(&suggested_name)
        .add_filter("Fountain screenplay", &["fountain", "txt", "md"])
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    allow(&app, &state, &path);
    Ok(Some(ScriptPathPayload {
        name: file_name_string(&path),
        path: path.to_string_lossy().into_owned(),
    }))
}

#[tauri::command]
fn read_script_file(state: State<Allowed>, path: String) -> Result<ScriptFilePayload, String> {
    let target = permitted(&state.0.lock().unwrap(), &path)?;
    read_payload(target)
}

#[tauri::command]
fn write_script_file(state: State<Allowed>, path: String, content: String) -> Result<u64, String> {
    let target = permitted(&state.0.lock().unwrap(), &path)?;
    if let Some(parent) = target.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(file_modified_ms(&target))
}

#[tauri::command]
fn export_file(suggested_name: String, content: String) -> Result<Option<String>, String> {
    let ext = Path::new(&suggested_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("fountain")
        .to_ascii_lowercase();
    let mut dialog = rfd::FileDialog::new()
        .set_title("Export Screenplay")
        .set_file_name(&suggested_name);
    if ext == "fdx" {
        dialog = dialog.add_filter("Final Draft (.fdx)", &["fdx"]);
    } else {
        dialog = dialog.add_filter("Fountain screenplay", &["fountain", "txt", "md"]);
    }
    let Some(path) = dialog.save_file() else {
        return Ok(None);
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn main() {
    tauri::Builder::default()
        .manage(Allowed::default())
        .setup(|app| {
            let loaded = load_allowed(app.handle());
            *app.state::<Allowed>().0.lock().unwrap() = loaded;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_open_script,
            pick_save_script,
            read_script_file,
            write_script_file,
            export_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Plainchant Tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(paths: &[&str]) -> HashSet<PathBuf> {
        paths.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn a_path_from_a_dialog_is_permitted() {
        let allowed = set(&["/home/w/film.fountain"]);
        assert_eq!(permitted(&allowed, "/home/w/film.fountain").unwrap(), PathBuf::from("/home/w/film.fountain"));
    }

    #[test]
    fn any_other_path_is_refused() {
        let allowed = set(&["/home/w/film.fountain"]);
        for bad in ["/etc/passwd", "/home/w/other.fountain", "/home/w/film.fountain.bak", ""] {
            assert_eq!(permitted(&allowed, bad), Err(NOT_CHOSEN.to_string()), "{bad}");
        }
    }

    #[test]
    fn a_path_that_climbs_out_is_refused() {
        let allowed = set(&["/home/w/film.fountain"]);
        assert!(permitted(&allowed, "/home/w/x/../film.fountain").is_err());
        assert!(permitted(&allowed, "/home/w/film.fountain/../../../etc/passwd").is_err());
    }

    #[test]
    fn nothing_is_permitted_before_a_pick() {
        assert!(permitted(&HashSet::new(), "/home/w/film.fountain").is_err());
    }
}
