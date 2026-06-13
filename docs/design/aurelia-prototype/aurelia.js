/* AURELIA shared behaviors: view-mode toggle, auth modals, filters, tabs */
(function () {
  'use strict';

  /* ---------- Admin / Customer view mode ---------- */
  var MODE_KEY = 'aurelia-view-mode';
  var saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch (e) {}
  var mode = saved === 'customer' ? 'customer' : 'admin';
  document.body.setAttribute('data-view', mode);

  function setMode(m) {
    mode = m;
    document.body.setAttribute('data-view', m);
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
    var btns = document.querySelectorAll('.au-mode-toggle button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-mode') === m);
    }
  }

  function buildToggle() {
    if (document.querySelector('.au-mode-toggle')) return;
    var wrap = document.createElement('div');
    wrap.className = 'au-mode-toggle';
    wrap.innerHTML =
      '<button type="button" data-mode="admin">Админ</button>' +
      '<button type="button" data-mode="customer">Покупатель</button>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) setMode(b.getAttribute('data-mode'));
    });
    setMode(mode);
  }

  /* ---------- Auth modals (injected on every page) ---------- */
  function buildModals() {
    if (document.getElementById('au-modal-login')) return;
    var host = document.createElement('div');
    host.innerHTML =
      '<div class="au-modal-overlay" id="au-modal-login" aria-hidden="true">' +
        '<div class="au-modal" role="dialog" aria-label="Вход в личный кабинет">' +
          '<button class="au-modal-close" type="button" data-close aria-label="Закрыть">' +
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l10 10M13 3L3 13"></path></svg>' +
          '</button>' +
          '<div class="au-modal-brand">AURELIA</div>' +
          '<h2>Вход в личный кабинет</h2>' +
          '<form onsubmit="return false;">' +
            '<div class="au-field"><label for="login-email">E-mail</label>' +
              '<input id="login-email" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
            '<div class="au-field"><label for="login-pass">Пароль</label>' +
              '<input id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>' +
            '<button class="au-btn au-btn--primary au-btn--block" type="submit">Войти</button>' +
          '</form>' +
          '<div class="au-modal-aux"><a href="#" onclick="return false;">Забыли пароль?</a></div>' +
          '<div class="au-modal-switch">Нет аккаунта? <a href="#" data-open-register>Зарегистрироваться</a></div>' +
        '</div>' +
      '</div>' +
      '<div class="au-modal-overlay" id="au-modal-register" aria-hidden="true">' +
        '<div class="au-modal" role="dialog" aria-label="Регистрация">' +
          '<button class="au-modal-close" type="button" data-close aria-label="Закрыть">' +
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l10 10M13 3L3 13"></path></svg>' +
          '</button>' +
          '<div class="au-modal-brand">AURELIA</div>' +
          '<h2>Регистрация</h2>' +
          '<form onsubmit="return false;">' +
            '<div class="au-field"><label for="reg-name">Имя</label>' +
              '<input id="reg-name" type="text" placeholder="Как к вам обращаться" autocomplete="name"></div>' +
            '<div class="au-field"><label for="reg-email">E-mail</label>' +
              '<input id="reg-email" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
            '<div class="au-field"><label for="reg-pass">Пароль</label>' +
              '<input id="reg-pass" type="password" placeholder="Минимум 8 символов" autocomplete="new-password"></div>' +
            '<div class="au-field"><label for="reg-pass2">Повторите пароль</label>' +
              '<input id="reg-pass2" type="password" placeholder="Ещё раз" autocomplete="new-password"></div>' +
            '<button class="au-btn au-btn--primary au-btn--block" type="submit">Зарегистрироваться</button>' +
          '</form>' +
          '<div class="au-modal-switch">Уже есть аккаунт? <a href="#" data-open-login>Войти</a></div>' +
        '</div>' +
      '</div>';
    while (host.firstChild) document.body.appendChild(host.firstChild);
  }

  function openModal(id) {
    closeModals();
    var m = document.getElementById(id);
    if (m) { m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); }
  }
  function closeModals() {
    var open = document.querySelectorAll('.au-modal-overlay.is-open');
    for (var i = 0; i < open.length; i++) {
      open[i].classList.remove('is-open');
      open[i].setAttribute('aria-hidden', 'true');
    }
  }
  window.auOpenLogin = function () { openModal('au-modal-login'); };
  window.auOpenRegister = function () { openModal('au-modal-register'); };
  window.auCloseModals = closeModals;

  /* ---------- Delegated clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-open-login]')) { e.preventDefault(); openModal('au-modal-login'); return; }
    if (t.closest('[data-open-register]')) { e.preventDefault(); openModal('au-modal-register'); return; }
    if (t.closest('[data-close]')) { closeModals(); return; }
    var ov = t.classList && t.classList.contains('au-modal-overlay');
    if (ov) { closeModals(); return; }

    /* favorite hearts toggle */
    var fav = t.closest('[data-fav]');
    if (fav) { e.preventDefault(); fav.classList.toggle('is-active'); return; }

    /* filter group collapse */
    var fh = t.closest('.au-filter-head');
    if (fh) { fh.parentElement.classList.toggle('is-closed'); return; }

    /* mobile filters */
    if (t.closest('[data-open-filters]')) {
      var f = document.querySelector('.au-filters');
      if (f) f.classList.add('is-open-mobile');
      return;
    }
    if (t.closest('.au-filters-close-mobile')) {
      var f2 = document.querySelector('.au-filters');
      if (f2) f2.classList.remove('is-open-mobile');
      return;
    }

    /* tabs */
    var tab = t.closest('.au-tab');
    if (tab && tab.hasAttribute('data-tab')) {
      var group = tab.closest('[data-tabs]');
      if (group) {
        var name = tab.getAttribute('data-tab');
        var tabs = group.querySelectorAll('.au-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i] === tab);
        var panels = document.querySelectorAll('[data-tab-panel]');
        for (var j = 0; j < panels.length; j++) {
          panels[j].hidden = panels[j].getAttribute('data-tab-panel') !== name;
        }
      }
      return;
    }

    /* variant pills */
    var v = t.closest('.au-variant');
    if (v) {
      var row = v.parentElement;
      var vs = row.querySelectorAll('.au-variant');
      for (var k = 0; k < vs.length; k++) vs[k].classList.remove('is-active');
      v.classList.add('is-active');
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModals();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { buildToggle(); buildModals(); });
  } else {
    buildToggle();
    buildModals();
  }
})();
