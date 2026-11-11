"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { shouldSkipVideo, sourceType, STALL_MS, type ConnectionLike } from "./hero-video-policy";

interface HeroVideoProps {
  src: string;
  mime?: string | null;
  /** The hero's poster image URL: shown by the browser until the first frame, never a replacement for the `<Image priority>` LCP. */
  posterUrl?: string | null;
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function connectionOf(): ConnectionLike | null {
  return (navigator as Navigator & { connection?: ConnectionLike }).connection ?? null;
}

// Poster only for reduced motion, Save-Data and slow connections. The server snapshot is "false" so the server HTML
// always carries the (hidden) video; the client re-renders to null after hydration when the policy says skip.
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCE_QUERY);
  mql.addEventListener("change", onChange);
  const conn = connectionOf() as (ConnectionLike & EventTarget) | null;
  conn?.addEventListener?.("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    conn?.removeEventListener?.("change", onChange);
  };
}
const getSkip = (): boolean => shouldSkipVideo({ reducedMotion: window.matchMedia(REDUCE_QUERY).matches, connection: connectionOf() });

/**
 * Optional looping background video of a hero, drawn over the poster `<Image>` in the same box (`absolute inset-0`,
 * so nothing shifts). Muted, no controls, no sound, decorative (`aria-hidden`). The poster stays the visible frame until
 * the video really plays (opacity fade-in after `playing` + a first frame). Any failure (error event, rejected `play()`,
 * a stall longer than `STALL_MS`) unmounts the video and leaves the poster; it never shows a player UI. Pauses when the
 * hero is off screen or the tab is hidden. Without JS the poster shows and the invisible video does not matter.
 */
export function HeroVideo({ src, mime, posterUrl }: HeroVideoProps) {
  const skip = useSyncExternalStore(subscribe, getSkip, () => false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const playing = playingSrc === src;
  const ref = useRef<HTMLVideoElement | null>(null);
  const active = !skip && !failed;

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    // React does not reflect the `muted` attribute onto the property: without this iOS refuses autoplay.
    el.muted = true;
    el.defaultMuted = true;

    let visible = true;
    let tabHidden = document.visibilityState === "hidden";
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const fail = () => setFailedSrc(src);
    const clearStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = null;
    };
    const markPlaying = () => {
      clearStall();
      const reveal = () => setPlayingSrc(src);
      const rvfc = (el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
      if (typeof rvfc === "function") rvfc.call(el, reveal);
      else reveal();
    };
    const sync = () => {
      if (visible && !tabHidden) {
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(fail); // autoplay blocked (low-power mode, policy): poster only
      } else {
        el.pause();
      }
    };
    const onStalled = () => {
      if (!stallTimer) stallTimer = setTimeout(fail, STALL_MS);
    };
    // Events that fired before hydration were missed: look at the element's current state.
    if (el.error) {
      fail();
      return;
    }
    // A <source> that failed before hydration fired its `error` unseen and left NETWORK_NO_SOURCE behind. A freshly
    // mounted element reports the same value until the resource selection reaches a stable state (a task later), so look
    // once after that instead of right now.
    const noSourceCheck = setTimeout(() => {
      if (el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fail();
    }, 100);
    if (!el.paused && el.readyState >= 2) markPlaying();

    el.addEventListener("playing", markPlaying);
    el.addEventListener("stalled", onStalled);
    el.addEventListener("waiting", onStalled);
    el.addEventListener("canplay", clearStall);
    el.addEventListener("timeupdate", clearStall);
    el.addEventListener("error", fail);
    const source = el.querySelector("source");
    source?.addEventListener("error", fail);

    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            visible = entries[entries.length - 1]?.isIntersecting ?? true;
            sync();
          })
        : null;
    io?.observe(el);
    const onVisibility = () => {
      tabHidden = document.visibilityState === "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    sync();

    return () => {
      clearTimeout(noSourceCheck);
      clearStall();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("playing", markPlaying);
      el.removeEventListener("stalled", onStalled);
      el.removeEventListener("waiting", onStalled);
      el.removeEventListener("canplay", clearStall);
      el.removeEventListener("timeupdate", clearStall);
      el.removeEventListener("error", fail);
      source?.removeEventListener("error", fail);
    };
  }, [active, src]);

  if (!active) return null;

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={posterUrl || undefined}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      disableRemotePlayback
      data-hero-video={playing ? "playing" : "pending"}
      className={cn(
        "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none",
        playing ? "opacity-100" : "opacity-0",
      )}
    >
      <source src={src} type={sourceType(mime)} />
    </video>
  );
}
