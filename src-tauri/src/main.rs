#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

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
fn pick_open_script() -> Result<Option<ScriptFilePayload>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Open Fountain Screenplay")
        .add_filter("Fountain screenplay", &["fountain", "txt", "md"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    read_payload(path).map(Some)
}

#[tauri::command]
fn pick_save_script(suggested_name: String) -> Result<Option<ScriptPathPayload>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Sync Screenplay with File")
        .set_file_name(&suggested_name)
        .add_filter("Fountain screenplay", &["fountain", "txt", "md"])
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    Ok(Some(ScriptPathPayload {
        name: file_name_string(&path),
        path: path.to_string_lossy().into_owned(),
    }))
}

#[tauri::command]
fn read_script_file(path: String) -> Result<ScriptFilePayload, String> {
    read_payload(PathBuf::from(path))
}

#[tauri::command]
fn write_script_file(path: String, content: String) -> Result<u64, String> {
    let target = PathBuf::from(&path);
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
