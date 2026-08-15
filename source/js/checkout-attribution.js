/*
 * checkout-attribution.js
 * -----------------------
 *
 * WHY THIS FILE EXISTS
 *
 * Our checkout is hosted by PayPro Global, on their domain. That means the
 * moment a customer actually pays, it happens on a page we do not control and
 * cannot tag. Google Analytics has therefore never recorded a single purchase:
 * it sees the click on "Purchase Now" (add_to_cart) and then nothing.
 *
 * We close that gap on the server: PayPro sends our server a notification when
 * an order is charged, and our server reports the purchase to Google Analytics.
 *
 * But a purchase reported by a server has no idea *whose* visit it belongs to.
 * That is what this file supplies. Just before the customer leaves for PayPro,
 * we attach two identifiers to the checkout URL:
 *
 *   x-cid    the Google Analytics client id  -> which visitor/session this is
 *   x-gclid  the Google Ads click id         -> which ad brought them here
 *
 * PayPro keeps any parameter beginning with "x-" and hands it back to us in the
 * purchase notification. So the round trip is:
 *
 *   this file  ->  PayPro checkout  ->  PayPro notification  ->  our server  ->  GA4
 *
 * This is the only step that cannot be added later. A payment whose identifiers
 * were never attached at click time is permanently unattributable, so it is
 * worth having even before the server half exists.
 *
 * WHAT IT DOES NOT DO
 *
 * Nothing is sent anywhere from here, and no new cookie is set. We only read two
 * cookies that Google's own tags already wrote, and append their values to a
 * link. If the visitor declined analytics cookies in the consent banner, those
 * cookies do not exist, we append nothing, and their purchase will still be
 * counted -- just without attribution. That is the correct behaviour, not a bug.
 */

(function () {
  'use strict';

  var CHECKOUT_HOST = 'store.payproglobal.com';

  /* ---------------------------------------------------------------- reading */

  function readCookie(name) {
    // Cookies arrive as one string: "a=1; b=2; c=3".
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  /*
   * Google Analytics keeps its visitor id in the "_ga" cookie, shaped:
   *
   *     GA1.1.1234567890.1717430400
   *     ^   ^ ^--------- ^---------- the two parts that form the client id
   *     |   version/domain-depth
   *     cookie format
   *
   * The client id Google expects is the last two parts joined with a dot,
   * i.e. "1234567890.1717430400". This cookie lives for two years, which is
   * what lets us connect a trial download in July to a purchase in August.
   */
  function googleAnalyticsClientId() {
    var raw = readCookie('_ga');
    if (!raw) {
      return null; // analytics cookies declined, or first hit not yet processed
    }
    var parts = raw.split('.');
    if (parts.length < 4) {
      return null; // unfamiliar shape; better to send nothing than send junk
    }
    return parts.slice(-2).join('.');
  }

  /*
   * The Google Ads conversion linker (already on every page of this site)
   * stores the ad click id in the "_gcl_aw" cookie, shaped:
   *
   *     GCL.1717430400.EAIaIQobChMI...
   *                    ^------------- the gclid we want
   *
   * We keep everything from the third part onwards, in case a gclid ever
   * contains a dot of its own.
   */
  function googleAdsClickId() {
    var raw = readCookie('_gcl_aw');
    if (!raw) {
      return null; // visitor did not arrive from a Google ad, or ads cookies declined
    }
    var parts = raw.split('.');
    if (parts.length < 3) {
      return null;
    }
    return parts.slice(2).join('.');
  }

  /* ---------------------------------------------------------------- writing */

  /*
   * We deliberately treat the checkout URL as text instead of parsing it with
   * new URL(). The existing links contain square brackets -- for example
   * "?products[1][id]=96924" -- and re-serialising them through URL() would
   * percent-encode those brackets. Appending to the string leaves the part that
   * already works untouched.
   */
  function separatorFor(url) {
    return url.indexOf('?') === -1 ? '?' : '&';
  }

  function withIdentifiers(href) {
    var url = href.trim();

    // Remove any values we appended earlier, so running this twice on the same
    // link cannot produce "&x-cid=a&x-cid=b".
    url = url.replace(/[?&]x-cid=[^&]*/g, '').replace(/[?&]x-gclid=[^&]*/g, '');

    var clientId = googleAnalyticsClientId();
    var clickId = googleAdsClickId();

    if (clientId) {
      url += separatorFor(url) + 'x-cid=' + encodeURIComponent(clientId);
    }
    if (clickId) {
      url += separatorFor(url) + 'x-gclid=' + encodeURIComponent(clickId);
    }
    return url;
  }

  function checkoutLinks() {
    var links = document.querySelectorAll('a[href*="' + CHECKOUT_HOST + '"]');
    return Array.prototype.slice.call(links);
  }

  /* ------------------------------------------------------------------ wiring */

  /*
   * The identifiers are attached at two moments, on purpose:
   *
   *  1. On load, so the link is already correct even if the click handler below
   *     never runs for some reason.
   *  2. On click, because the consent banner may have been accepted after load,
   *     which is the moment the "_ga" cookie first appears. Reading a cookie is
   *     instant, so doing it inside the click handler is safe -- the browser
   *     reads href only after our handler returns.
   *
   * Both paths are idempotent, so running them in either order is fine.
   */
  function attachIdentifiers() {
    checkoutLinks().forEach(function (link) {
      link.setAttribute('href', withIdentifiers(link.getAttribute('href')));
    });
  }

  function start() {
    attachIdentifiers();

    checkoutLinks().forEach(function (link) {
      link.addEventListener('click', function () {
        link.setAttribute('href', withIdentifiers(link.getAttribute('href')));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
