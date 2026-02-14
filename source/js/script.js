(function ($) {
  'use strict';

  // PRELOADER
  $(window).on('load', function () {
    $('#page-loader').fadeOut('slow', function () {
      $(this).remove();
    });
  });

  // navbarDropdown – use matchMedia to avoid layout read (no forced reflow)
  if (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) {
    $('.has-dropdown .dropdown-toggle').on('click', function () {
      $(this).siblings('.dropdown-menu').slideToggle(300);
    });
  }

  // Single scroll handler + rAF to avoid forced reflow (read layout once per frame)
  var scrollTicking = false;
  function onScrollTick() {
    var top = window.pageYOffset || document.documentElement.scrollTop;
    var past = top > 70;
    $('.scroll-to-top').toggleClass('reveal', past);
    $('.site-navigation,.trans-navigation').toggleClass('header-white', past);
    scrollTicking = false;
  }
  function onScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(onScrollTick);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // scroll-to-top – native smooth scroll to avoid jQuery animate reflows
  if ($('#scroll-to-top').length) {
    $('#scroll-to-top').on('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Closes responsive menu when a scroll trigger link is clicked
  $('.js-scroll-trigger').on('click', function (event) {
    $('.navbar-collapse').collapse('hide');
  });

})(jQuery);


