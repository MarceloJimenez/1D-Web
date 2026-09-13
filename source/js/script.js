(function () {
  'use strict';

  // Mobile menu toggle
  var toggler = document.querySelector('.navbar-toggler');
  var collapse = document.getElementById('navbarCollapse');
  if (toggler && collapse) {
    toggler.addEventListener('click', function () {
      var open = collapse.classList.toggle('show');
      toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  function closeMenu() {
    if (collapse && collapse.classList.contains('show')) {
      collapse.classList.remove('show');
      if (toggler) toggler.setAttribute('aria-expanded', 'false');
    }
  }

  // Dropdowns (products, language)
  var toggles = document.querySelectorAll('.dropdown-toggle');
  function closeDropdowns(except) {
    document.querySelectorAll('.dropdown-menu.show').forEach(function (m) {
      if (m !== except) m.classList.remove('show');
    });
    toggles.forEach(function (t) {
      var m = t.parentElement.querySelector('.dropdown-menu');
      if (m && !m.classList.contains('show')) t.setAttribute('aria-expanded', 'false');
    });
  }
  toggles.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var menu = t.parentElement.querySelector('.dropdown-menu');
      if (!menu) return;
      var willShow = !menu.classList.contains('show');
      closeDropdowns();
      if (willShow) menu.classList.add('show');
      t.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function () { closeDropdowns(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDropdowns(); closeMenu(); }
  });

  // Scroll state: reveal scroll-to-top, shadow on sticky nav
  var scrollTicking = false;
  var toTop = document.getElementById('scroll-to-top');
  var navbar = document.querySelector('.navbar');
  function onScrollTick() {
    var top = window.pageYOffset || document.documentElement.scrollTop;
    var past = top > 70;
    if (toTop) toTop.classList.toggle('reveal', past);
    if (navbar) navbar.classList.toggle('header-white', past);
    scrollTicking = false;
  }
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(onScrollTick);
    }
  }, { passive: true });

  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Close the mobile menu when a nav link is used
  document.querySelectorAll('.js-scroll-trigger').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  // Manual dark mode toggle (light by default; choice remembered)
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var root = document.documentElement;
      var dark = root.getAttribute('data-theme') === 'dark';
      if (dark) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', 'dark');
      }
      try { localStorage.setItem('themeMode', dark ? 'light' : 'dark'); } catch (e) {}
    });
  }
})();
