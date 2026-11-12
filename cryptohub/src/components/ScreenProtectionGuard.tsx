"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Global client-side screen-capture & screenshot protection guard.
 * Blocks print output, screenshot/capture key combinations, context menus,
 * accidental text scraping, and blacks out the viewport immediately when
 * focus leaves the app (e.g. OS Snipping Tool / task switcher) or capture
 * shortcuts are triggered.
 */
export function ScreenProtectionGuard({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [shieldReason, setShieldReason] = useState<string | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const releaseTimerRef = useRef<number | null>(null);

  const activateShield = useCallback((reason: string, autoClearMs?: number) => {
    if (curtainRef.current) {
      curtainRef.current.style.display = "flex";
    }
    setShieldReason(reason);

    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    if (autoClearMs && autoClearMs > 0) {
      releaseTimerRef.current = window.setTimeout(() => {
        if (!document.hidden && document.hasFocus()) {
          if (curtainRef.current) {
            curtainRef.current.style.display = "none";
          }
          setShieldReason(null);
        }
        releaseTimerRef.current = null;
      }, autoClearMs);
    }
  }, []);

  const deactivateShield = useCallback(() => {
    if (document.hidden) return;
    if (releaseTimerRef.current !== null) return;
    if (curtainRef.current) {
      curtainRef.current.style.display = "none";
    }
    setShieldReason(null);
  }, []);

  useEffect(() => {
    const clearClipboard = () => {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText("").catch(() => {
            // Clipboard permission may be withheld in some contexts.
          });
        }
      } catch {
        // Ignore clipboard errors.
      }
    };

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest("[data-allow-copy='true']"));
    };

    const isCaptureShortcut = (e: KeyboardEvent): string | null => {
      const key = (e.key || "").toLowerCase();
      const code = (e.code || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      // PrintScreen / SysRq (Windows, Linux, ChromeOS)
      if (key === "printscreen" || code === "printscreen" || e.keyCode === 44) {
        return "Screen capture key blocked";
      }

      // macOS screenshot shortcuts (Cmd+Shift+3 / 4 / 5 / 6)
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(key)) {
        return "System screenshot shortcut blocked";
      }

      // Browser/OS snipping shortcuts (Ctrl+Shift+S / Win+Shift+S)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "s") {
        return "Screen capture shortcut blocked";
      }

      // Print / Save page
      if (mod && (key === "p" || key === "s")) {
        return "Page print and export disabled";
      }

      // View source & DevTools inspection shortcuts
      if (
        key === "f12" ||
        (mod && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        (mod && key === "u")
      ) {
        return "Protected view inspection blocked";
      }

      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const reason = isCaptureShortcut(e);
      if (!reason) return;
      e.preventDefault();
      e.stopPropagation();
      if (reason.includes("capture") || reason.includes("screenshot")) {
        clearClipboard();
      }
      activateShield(reason, 2200);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const code = (e.code || "").toLowerCase();
      if (key === "printscreen" || code === "printscreen" || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        clearClipboard();
        activateShield("Screen capture key blocked", 2200);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const onDragStart = (e: DragEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const selection = window.getSelection()?.toString() || "";
      if (selection.length > 0) {
        e.preventDefault();
      }
    };

    const onBeforePrint = (e: Event) => {
      e.preventDefault?.();
      activateShield("Printing is disabled on this protected site", 2500);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        activateShield("Session protected while inactive");
      } else {
        deactivateShield();
      }
    };

    let blurCheckTimer: number | null = null;
    const onWindowBlur = () => {
      const isEmbeddedIframeFocus =
        document.activeElement?.tagName === "IFRAME" ||
        Boolean(document.querySelector("iframe:hover"));

      if (!isEmbeddedIframeFocus) {
        activateShield("Screen capture protection active");
      }

      if (blurCheckTimer !== null) {
        window.clearTimeout(blurCheckTimer);
      }
      blurCheckTimer = window.setTimeout(() => {
        blurCheckTimer = null;
        if (document.hidden || !document.hasFocus()) {
          activateShield("Screen capture protection active");
        } else {
          deactivateShield();
        }
      }, 40);
    };

    const onWindowFocus = () => {
      if (blurCheckTimer !== null) {
        window.clearTimeout(blurCheckTimer);
        blurCheckTimer = null;
      }
      deactivateShield();
    };

    const onPointerRestore = () => {
      if (document.hasFocus() && !document.hidden && releaseTimerRef.current === null) {
        deactivateShield();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    window.addEventListener("dragstart", onDragStart, { capture: true });
    document.addEventListener("copy", onCopy, { capture: true });
    window.addEventListener("beforeprint", onBeforePrint, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("pointerdown", onPointerRestore, { passive: true });

    return () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
      }
      if (blurCheckTimer !== null) {
        window.clearTimeout(blurCheckTimer);
      }
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("contextmenu", onContextMenu, { capture: true });
      window.removeEventListener("dragstart", onDragStart, { capture: true });
      document.removeEventListener("copy", onCopy, { capture: true });
      window.removeEventListener("beforeprint", onBeforePrint, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("pointerdown", onPointerRestore);
    };
  }, [activateShield, deactivateShield]);

  return (
    <>
      {children}
      <div
        ref={curtainRef}
        aria-hidden={!shieldReason}
        style={{ display: shieldReason ? "flex" : "none" }}
        className="fixed inset-0 z-[99999] bg-[#04060b] text-slate-100 flex-col items-center justify-center p-6 text-center select-none"
      >
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-950/90 p-6 shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30">
            <ShieldAlert className="h-6 w-6 text-rose-400" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">
            Screen Capture Disabled
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {shieldReason ||
              "Content is protected against screenshots and unauthorized screen capture."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (releaseTimerRef.current !== null) {
                window.clearTimeout(releaseTimerRef.current);
                releaseTimerRef.current = null;
              }
              if (curtainRef.current) {
                curtainRef.current.style.display = "none";
              }
              setShieldReason(null);
            }}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Resume Protected Session
          </button>
        </div>
      </div>
    </>
  );
}
