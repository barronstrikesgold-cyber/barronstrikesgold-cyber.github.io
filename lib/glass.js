/* Liquid Glass behaviors: header hairline on scroll, the capsule tab bar that
   shrinks while scrolling down, the large title that collapses into the bar,
   and a light haptic tick where the browser supports vibration.
   Pure progressive enhancement: with this file missing the app works the same. */
(function () {
  "use strict";
  var root = document.documentElement;
  var lastY = window.scrollY || 0;
  var ticking = false;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      var y = Math.max(0, window.scrollY || 0);
      root.classList.toggle("is-scrolled", y > 4);
      var nearEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
      if (y < 60 || nearEnd) root.classList.remove("tabs-min");
      else if (y > lastY + 6) root.classList.add("tabs-min");
      else if (y < lastY - 6) root.classList.remove("tabs-min");
      lastY = y;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  var observer = null;
  var watched = null;
  function headerBottom() {
    var bar = document.getElementById("topbar");
    return bar ? Math.round(bar.getBoundingClientRect().height) : 56;
  }
  function watchTitle() {
    var compact = document.getElementById("nav-compact");
    var screen = document.getElementById("screen");
    if (!compact || !screen || !("IntersectionObserver" in window)) return;
    var h1 = screen.querySelector("h1");
    if (h1 === watched) return;
    if (observer) observer.disconnect();
    watched = h1;
    root.classList.remove("title-collapsed");
    compact.textContent = h1 ? h1.textContent.trim() : "";
    if (!h1) return;
    observer = new IntersectionObserver(function (entries) {
      var e = entries[0];
      root.classList.toggle("title-collapsed", !e.isIntersecting && e.boundingClientRect.top < headerBottom());
    }, { rootMargin: "-" + headerBottom() + "px 0px 0px 0px", threshold: 0 });
    observer.observe(h1);
  }

  // Keep the selected My Stuff segment visible inside its scrolling capsule.
  function revealSegment() {
    var on = document.querySelector(".stuff-segments .chip.is-on");
    if (!on) return;
    var track = on.parentNode;
    var a = on.getBoundingClientRect();
    var t = track.getBoundingClientRect();
    track.scrollLeft = Math.max(0, track.scrollLeft + (a.left - t.left) - (t.width - a.width) / 2);
  }

  function haptic(event) {
    var el = event.target && event.target.closest ? event.target.closest(".tabbar button, .seg button, .stuff-segments .chip, .solid, .btn-primary") : null;
    if (!el || reduce.matches || typeof navigator.vibrate !== "function") return;
    try { navigator.vibrate(8); } catch (err) { /* not allowed here */ }
  }
  document.addEventListener("click", haptic, true);

  function start() {
    var screen = document.getElementById("screen");
    if (screen && "MutationObserver" in window) {
      new MutationObserver(function () {
        root.classList.remove("tabs-min");
        watchTitle();
        revealSegment();
      }).observe(screen, { childList: true });
    }
    watchTitle();
    revealSegment();
    onScroll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
