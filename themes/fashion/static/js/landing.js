(function () {
  'use strict';

  // --- Scroll-triggered fade-in ---
  function observeFade() {
    const els = document.querySelectorAll('.lp-fade');
    if (!els.length) return;
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    els.forEach(function (el) { observer.observe(el); });
  }

  // --- FAQ accordion ---
  function setupFAQ() {
    var items = document.querySelectorAll('.lp-faq-item');
    items.forEach(function (item) {
      var btn = item.querySelector('.lp-faq-question');
      var answer = item.querySelector('.lp-faq-answer');
      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        // Close all
        items.forEach(function (i) {
          i.classList.remove('open');
          i.querySelector('.lp-faq-answer').style.maxHeight = null;
        });
        // Toggle current
        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  }

  // --- Mobile menu toggle ---
  function setupMenu() {
    var toggle = document.querySelector('.lp-menu-toggle');
    var nav = document.querySelector('.lp-header-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.classList.toggle('open');
      var expanded = toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true';
      toggle.setAttribute('aria-expanded', expanded);
    });
  }

  // --- Header shadow on scroll ---
  function setupHeaderShadow() {
    var header = document.querySelector('.lp-header');
    if (!header) return;
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // --- Lazy loading (data-src images + data-bg elements) ---
  function setupLazy() {
    var imgs = document.querySelectorAll('.lp-lazy');
    if (!imgs.length) return;
    if ('loading' in HTMLImageElement.prototype) {
      imgs.forEach(function (img) {
        if (img.dataset.src) img.src = img.dataset.src;
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) img.src = img.dataset.src;
            img.addEventListener('load', function () { img.classList.add('loaded'); });
            img.addEventListener('error', function () { img.classList.add('error'); });
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    imgs.forEach(function (img) { observer.observe(img); });
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    observeFade();
    setupFAQ();
    setupMenu();
    setupHeaderShadow();
    setupLazy();
  });
})();
