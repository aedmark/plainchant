use std::fs;
use std::path::{Path, PathBuf};

fn copy_dir_recursive(src: &Path, dst: &Path) {
    let _ = fs::create_dir_all(dst);
    println!("cargo:rerun-if-changed={}", src.display());
    if let Ok(entries) = fs::read_dir(src) {
        for entry in entries.flatten() {
            let path = entry.path();
            let target = dst.join(entry.file_name());
            if path.is_dir() {
                copy_dir_recursive(&path, &target);
            } else {
                println!("cargo:rerun-if-changed={}", path.display());
                let _ = fs::copy(&path, &target);
            }
        }
    }
}

fn stage_frontend_dist() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest_dir.parent().unwrap();
    let dist = manifest_dir.join("dist");
    let _ = fs::create_dir_all(&dist);

    for file in ["index.html", "app.html", "manifest.webmanifest", "sw.js"] {
        let src = root.join(file);
        println!("cargo:rerun-if-changed={}", src.display());
        if src.exists() {
            let _ = fs::copy(&src, dist.join(file));
        }
    }

    for dir in ["src", "fonts", "icons"] {
        let src = root.join(dir);
        if src.exists() {
            copy_dir_recursive(&src, &dist.join(dir));
        }
    }
}

fn main() {
    stage_frontend_dist();
    tauri_build::build()
}
