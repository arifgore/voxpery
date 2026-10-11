//! Keyboard focus for the Linux CEF webview (tauri-apps/tauri#16251).
//!
//! On Linux the CEF browser is a foreign X11 child of the GTK window. After the window is
//! shown, focused or reactivated, X11 input focus can stay on GTK's focus proxy: clicks still
//! focus page inputs, but no key events reach the page. When the window gains focus, give the
//! browser CEF focus and move X11 input focus to the browser window.

use cef::{ImplBrowser, ImplBrowserHost};
use std::mem::MaybeUninit;
use x11_dl::xlib;

pub fn focus_webview_keyboard(window: &tauri::WebviewWindow) {
    // with_webview only queues the callback for CEF's UI thread, so it is safe to call from a
    // window event handler (blocking webview getters there deadlock under CEF).
    let _ = window.with_webview(|platform| {
        let Some(webview) = platform.downcast_ref::<tauri_runtime_cef::Webview>() else {
            return;
        };
        let Some(host) = webview.browser().host() else {
            return;
        };
        host.set_focus(1);
        focus_x11_window(host.window_handle() as xlib::Window);
    });
}

/// Runs on CEF's UI thread, which owns the X display returned by `cef::get_xdisplay`.
fn focus_x11_window(window: xlib::Window) {
    if window == 0 {
        return;
    }
    let Ok(x) = xlib::Xlib::open() else {
        return;
    };
    unsafe {
        let display = cef::get_xdisplay().cast::<xlib::Display>();
        if display.is_null() {
            return;
        }
        let mut attributes = MaybeUninit::<xlib::XWindowAttributes>::uninit();
        // Focusing an unmapped window raises a BadMatch X error.
        if (x.XGetWindowAttributes)(display, window, attributes.as_mut_ptr()) != 0
            && attributes.assume_init().map_state == xlib::IsViewable
        {
            (x.XSetInputFocus)(display, window, xlib::RevertToParent, xlib::CurrentTime);
            (x.XFlush)(display);
        }
    }
}
