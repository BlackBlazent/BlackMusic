// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 2.2.0: the app now lives in lib.rs (`run`) so the same code serves desktop AND the Android/iOS entry points.
fn main() {
    blackmusic_lib::run()
}
