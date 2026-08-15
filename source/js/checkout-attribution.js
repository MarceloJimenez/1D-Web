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
 * PayPro can close that gap themselves: their checkout pages will fire the GA4
 * "purchase" event directly, provided each product carries our Measurement ID in
 * their control panel (Store Settings -> Product Setup). But an event fired on
 * their domain has no idea *whose* visit it belongs to, because the analytics
 * cookies live on ours.
 *
 * That is what this file supplies. Just before the customer leaves for PayPro,
 * we attach four parameters to the checkout URL:
 *
 *   ga-client-id   GA4 client id   -> PayPro's own GA4 integration reads these
 *   ga-session-id  GA4 session id  -> and attributes the purchase to this visit
 *
 *   x-cid          the same client id, under a name PayPro hands back verbatim
 *   x-gclid        the Google Ads click id
 *
 * The two pairs serve different consumers, which is why both are sent:
 *
 *   ga-*  PayPro reads them and reports the purchase to GA4 for us. No server
 *         of ours involved. This is the path that actually runs today.
 *   x-*   PayPro stores them and returns them in the purchase notification, for
 *         a webhook of ours to use. That webhook is written and tested but not
 *         yet reachable, and the x- parameters cost nothing to keep sending.
 *         They are also the only route by which a gclid could ever reach Google
 *         Ads as an offline conversion, which the ga- pair does not cover.
 *
 * This is the only step that cannot be added later. A payment whose identifiers
 * were never attached at click time is permanently unattributable, so it is
 * worth having regardless of which consumer ends up using them.
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

  /*
   * The GA4 property this site reports to. Used to find the session cookie,
   * which Google names after the measurement id with the "G-" removed:
   * G-GEMX6GE7X1 -> _ga_GEMX6GE7X1. If the property ever changes, this is the
   * one line to change with it.
   */
  var MEASUREMENT_ID = 'G-GEMX6GE7X1';

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
   * The session id lives in a second cookie, named after the measurement id.
   * Google has used two shapes for it, and both are still out there:
   *
   *   GS2.1.s1786810041$o2$g0$t1786810041$j60$l0$h883238766
   *          ^--------- session id, after the "s", before the "$"
   *
   *   GS1.1.1786810041.2.1.1786810100.0.0.0
   *         ^--------- session id, third dot-separated field
   *
   * This site currently writes the GS2 shape (checked 2026-08-15), but reading
   * both costs three lines and saves a silent breakage the day Google switches
   * again. Returning null is always safe: PayPro treats a missing session id as
   * "start a new session", which loses the join to this visit but never
   * corrupts anything.
   */
  function googleAnalyticsSessionId() {
    var raw = readCookie('_ga_' + MEASUREMENT_ID.replace(/^G-/, ''));
    if (!raw) {
      return null;
    }

    var gs2 = raw.match(/(?:^|\.)s(\d+)(?:\$|$)/);
    if (gs2) {
      return gs2[1];
    }

    var parts = raw.split('.');
    if (parts.length > 2 && /^\d+$/.test(parts[2])) {
      return parts[2];
    }
    return null;
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
    url = url.replace(/[?&](x-cid|x-gclid|ga-client-id|ga-session-id)=[^&]*/g, '');

    var clientId = googleAnalyticsClientId();
    var sessionId = googleAnalyticsSessionId();
    var clickId = googleAdsClickId();

    // Read by PayPro's own GA4 integration, which fires the purchase event.
    if (clientId) {
      url += separatorFor(url) + 'ga-client-id=' + encodeURIComponent(clientId);
    }
    if (sessionId) {
      url += separatorFor(url) + 'ga-session-id=' + encodeURIComponent(sessionId);
    }

    // Handed back to us verbatim in the purchase notification. Nothing consumes
    // these yet; see the note at the top of this file for why they are sent.
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
