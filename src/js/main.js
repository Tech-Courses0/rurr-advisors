(function(){
  "use strict";

  var ENDPOINT = (window.SITE && window.SITE.endpoint) || "";
  var ENDPOINT_READY = !!ENDPOINT && ENDPOINT.indexOf("PASTE_") === -1;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* POST helper — text/plain keeps this a "simple" request so the browser
     skips the CORS preflight that the Apps Script web app can't answer.
     The script reads the raw JSON body from e.postData.contents. */
  function postForm(payload){
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function(res){ return res.json(); });
  }

  /* -------- small helpers -------- */
  function $(id){ return document.getElementById(id); }
  function show(el){ if(el) el.classList.add('show'); }
  function hide(el){ if(el) el.classList.remove('show'); }
  function emailOk(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function prettyDate(v){
    if(!v) return '';
    if(/^\d{1,2}\s\w{3}\s\d{4}$/.test(v)) return v;        /* already "09 Jun 2026" */
    var d = new Date(v);
    if(isNaN(d.getTime())) return v;
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }

  function markInvalid(field, bad){
    if(!field) return;
    field.style.borderColor = bad ? '#a3793a' : '';
  }

  /* -------- field-level validation -------- */
  function cleanPhone(v){ return String(v || '').replace(/[\s\-()]/g, ''); }
  function phoneValid(v){ return /^(?:\+?91|0)?[6-9]\d{9}$/.test(cleanPhone(v)); }
  function normPhone(v){
    var c = cleanPhone(v);
    if(/^\+91[6-9]\d{9}$/.test(c)) return c;
    if(/^91[6-9]\d{9}$/.test(c))  return '+' + c;
    if(/^0[6-9]\d{9}$/.test(c))   return '+91' + c.slice(1);
    if(/^[6-9]\d{9}$/.test(c))    return '+91' + c;
    return c;
  }
  function fieldErr(input, msg){
    var field = (input.closest && input.closest('.field')) || input.parentNode;
    var el = field.querySelector('.field-err');
    if(msg){
      if(!el){ el = document.createElement('p'); el.className = 'field-err'; field.appendChild(el); }
      el.textContent = msg;
      input.setAttribute('aria-invalid', 'true');
      input.style.borderColor = '#a3793a';
    } else {
      if(el && el.parentNode) el.parentNode.removeChild(el);
      input.removeAttribute('aria-invalid');
      input.style.borderColor = '';
    }
  }
  function validateField(el, type, required){
    var v = el.value.trim();
    if(!v){
      if(!required) return '';
      return type === 'name'  ? 'Please enter your full name.'
           : type === 'email' ? 'Please enter your email address.'
           : type === 'phone' ? 'Please enter your phone number.'
           : type === 'details' ? 'Please describe your complaint.'
           : 'This field is required.';
    }
    if(type === 'name'  && (v.length < 2 || !/[A-Za-z]/.test(v))) return 'Please enter your full name.';
    if(type === 'email' && !emailOk(v))   return 'Please enter a valid email address.';
    if(type === 'phone' && !phoneValid(v)) return 'Enter a valid Indian mobile number (e.g. +919876543210).';
    return '';
  }
  function runValidation(specs){
    var ok = true, first = null;
    specs.forEach(function(s){
      var msg = validateField(s.el, s.type, s.required);
      fieldErr(s.el, msg);
      if(msg){ ok = false; if(!first) first = s.el; }
    });
    if(first) first.focus();
    return ok;
  }
  function wireClearOnInput(ids){
    ids.forEach(function(id){ var el = $(id); if(el) el.addEventListener('input', function(){ fieldErr(el, ''); }); });
  }

  function setLoading(btn, loading, text){
    if(!btn) return;
    if(loading){
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = text || 'Please wait…';
    } else {
      btn.disabled = false;
      if(btn.dataset.html){ btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
    }
  }

  /* -------- Reveal-on-scroll -------- */
  function staggerDelay(el){
    if(el.style.getPropertyValue('--d')) return;            /* respect explicit order */
    var i = 0, p = el.previousElementSibling;
    while(p){ if(p.classList && p.classList.contains('reveal')) i++; p = p.previousElementSibling; }
    el.style.setProperty('--d', Math.min(i, 6));
  }

  function countUp(el){
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if(reduceMotion){ el.textContent = target; return; }
    var start = null, dur = 1400;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function observeReveals(scope){
    var els = Array.prototype.slice.call((scope || document).querySelectorAll('.reveal'));
    els.forEach(staggerDelay);
    if(!('IntersectionObserver' in window)){
      els.forEach(function(el){
        el.classList.add('in');
        el.querySelectorAll('[data-count]').forEach(countUp);
      });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('in');
          var counters = e.target.querySelectorAll('[data-count]');
          if(counters.length){ counters.forEach(function(c){ if(!c.dataset.done){ c.dataset.done = '1'; countUp(c); } }); }
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function(el){ el.classList.remove('in'); io.observe(el); });
  }

  /* -------- Header shadow + scroll progress -------- */
  var header = $('header');
  var progress = $('scrollProgress');
  function onScroll(){
    if(header) header.classList.toggle('scrolled', window.scrollY > 12);
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var p = max > 0 ? (window.scrollY || doc.scrollTop) / max : 0;
    if(progress) progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });

  /* -------- Pointer parallax on hero glow (home only) -------- */
  var hero = document.querySelector('.hero');
  if(hero && !reduceMotion){
    var rafId = null, lastX = 0, lastY = 0;
    window.addEventListener('mousemove', function(e){
      lastX = e.clientX; lastY = e.clientY;
      if(rafId) return;
      rafId = requestAnimationFrame(function(){
        rafId = null;
        var x = lastX / window.innerWidth, y = lastY / window.innerHeight;
        hero.style.setProperty('--mx', (80 + x * 18).toFixed(1) + '%');
        hero.style.setProperty('--my', (-16 + y * 16).toFixed(1) + '%');
      });
    }, { passive:true });
  }

  /* -------- Mobile menu -------- */
  var menu = $('mobileMenu');
  var toggle = $('menuToggle');
  function openMenu(){ if(!menu) return; menu.classList.add('open'); toggle.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; }
  function closeMenu(){ if(!menu) return; menu.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); document.body.style.overflow=''; }
  if(toggle) toggle.addEventListener('click', openMenu);
  var mmClose = $('mmClose');
  if(mmClose) mmClose.addEventListener('click', closeMenu);

  /* ============================================================
     CONTACT FORM  →  POST {endpoint}  (Google Apps Script web app)
     Body: { type:'contact', name, email, phone, interest, message }
     Response: { ok: true }  (script writes to the Sheet + emails)
     ============================================================ */
  var contactForm = $('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = $('cSubmit');
      hide($('cSuccess')); hide($('cError'));

      if(!runValidation([
        { el: $('cName'),  type: 'name',  required: true },
        { el: $('cEmail'), type: 'email', required: true },
        { el: $('cPhone'), type: 'phone', required: true }
      ])) return;

      if(!ENDPOINT_READY){ show($('cError')); return; }

      var payload = {
        type: 'contact',
        name: $('cName').value.trim(),
        email: $('cEmail').value.trim(),
        phone: normPhone($('cPhone').value),
        interest: $('cInterest').value,
        message: $('cMsg').value.trim()
      };

      setLoading(btn, true, 'Sending…');
      postForm(payload).then(function(data){
        if(data && data.ok){ show($('cSuccess')); contactForm.reset(); }
        else { show($('cError')); }
      }).catch(function(){
        show($('cError'));
      }).then(function(){
        setLoading(btn, false);
      });
    });
  }

  /* ============================================================
     GRIEVANCE — RAISE  →  POST {endpoint}  (Apps Script)
     Body: { type:'complaint', name, email, phone, category, details }
     Response: { ok: true, ticket: "RA-2026-12345" }
     ============================================================ */
  var grvForm = $('grvForm');
  if(grvForm){
    grvForm.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = $('gSubmit');
      hide($('gResult')); hide($('gError'));

      if(!runValidation([
        { el: $('gName'),  type: 'name',    required: true },
        { el: $('gEmail'), type: 'email',   required: true },
        { el: $('gPhone'), type: 'phone',   required: true },
        { el: $('gMsg'),   type: 'details', required: true }
      ])) return;

      if(!ENDPOINT_READY){ show($('gError')); return; }

      var payload = {
        type: 'complaint',
        name: $('gName').value.trim(),
        email: $('gEmail').value.trim(),
        phone: normPhone($('gPhone').value),
        category: $('gCat').value,
        details: $('gMsg').value.trim()
      };

      setLoading(btn, true, 'Submitting…');
      postForm(payload).then(function(data){
        if(data && data.ok && data.ticket){
          $('gTicket').textContent = data.ticket;
          $('gEmailEcho').textContent = payload.email;
          show($('gResult'));
          grvForm.reset();
        } else {
          show($('gError'));
        }
      }).catch(function(){
        show($('gError'));
      }).then(function(){
        setLoading(btn, false);
      });
    });
  }

  /* ============================================================
     GRIEVANCE — TRACK  →  GET {endpoint}?ticket=RA-...  (Apps Script)
     Response: { found:true, num, status, opened, updated, eta, stage }
               or { found:false }            (stage = 1|2|3)
     ============================================================ */
  function renderTicket(t){
    hide($('tNotFound')); hide($('tError'));
    $('tOutNum').textContent = t.num || '';
    $('tOutStatus').textContent = t.status || '';
    $('tOutOpened').textContent = prettyDate(t.opened);
    $('tOutUpdated').textContent = prettyDate(t.updated);
    $('tOutEta').textContent = (t.stage === 3) ? 'Resolved' : prettyDate(t.eta);
    var stps = document.querySelectorAll('#tStepper .stp');
    Array.prototype.forEach.call(stps, function(s){
      var st = parseInt(s.getAttribute('data-stage'), 10);
      s.classList.toggle('done', st <= t.stage);
      s.classList.toggle('current', st === t.stage);
    });
    show($('tResult'));
  }

  var trackForm = $('trackForm');
  if(trackForm){
    trackForm.addEventListener('submit', function(e){
      e.preventDefault();
      var inp = $('tNum'), btn = $('tSubmit');
      var key = (inp.value || '').trim().toUpperCase();
      hide($('tResult')); hide($('tNotFound')); hide($('tError'));
      if(!key){ markInvalid(inp, true); return; }
      markInvalid(inp, false);

      if(!ENDPOINT_READY){ show($('tError')); return; }

      setLoading(btn, true, 'Checking…');
      fetch(ENDPOINT + (ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'ticket=' + encodeURIComponent(key))
        .then(function(res){ return res.json(); })
        .then(function(data){
          if(data && data.found){
            renderTicket({ num:data.num, status:data.status, opened:data.opened, updated:data.updated, eta:data.eta, stage:Number(data.stage) });
          } else {
            show($('tNotFound'));
          }
        }).catch(function(){
          show($('tError'));
        }).then(function(){
          setLoading(btn, false);
        });
    });
  }

  /* ============================================================
     COMPLAINTS DATA  →  GET {endpoint}?report=complaints  (Apps Script)
     Renders the SEBI complaints tables live, aggregated from the sheet.
     Response shape:
       { ok, generatedAt, monthLabel,
         table1:{rows:[{source,pendingStart,received,resolved,totalPending,pendingGt3m,avgDays}], total:{...}},
         table2:{rows:[{month,carried,received,resolved,pending}], total:{received,resolved}},
         table3:{rows:[{year,carried,received,resolved,pending}], total:{received,resolved}} }
     ============================================================ */
  function esc(s){ var x = document.createElement('div'); x.textContent = (s == null ? '' : s); return x.innerHTML; }
  function nc(v){ return '<td class="num">' + (v == null ? '' : v) + '</td>'; }

  function renderComplaintsData(){
    var wrap = $('cdTables');
    if(!wrap) return;
    var loading = $('cdLoading');
    function fail(){ if(loading) loading.style.display = 'none'; show($('cdError')); }
    if(!ENDPOINT_READY){ fail(); return; }

    fetch(ENDPOINT + (ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'report=complaints')
      .then(function(res){ return res.json(); })
      .then(function(d){
        if(!d || !d.ok) throw new Error('bad report');

        var t1 = '';
        d.table1.rows.forEach(function(r, i){
          t1 += '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r.source) + '</td>' +
            nc(r.pendingStart) + nc(r.received) + nc(r.resolved) + nc(r.totalPending) + nc(r.pendingGt3m) + nc(r.avgDays) + '</tr>';
        });
        var T1 = d.table1.total;
        t1 += '<tr><td class="num"></td><td><strong>Grand total</strong></td>' +
          nc(T1.pendingStart) + nc(T1.received) + nc(T1.resolved) + nc(T1.totalPending) + nc(T1.pendingGt3m) + nc(T1.avgDays) + '</tr>';
        $('cdT1Body').innerHTML = t1;
        $('cdT1Caption').textContent = 'Table 1 — Data for the month ending ' + (d.monthLabel || '');

        var t2 = '';
        d.table2.rows.forEach(function(r, i){
          t2 += '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r.month) + '</td>' +
            nc(r.carried) + nc(r.received) + nc(r.resolved) + nc(r.pending) + '</tr>';
        });
        t2 += '<tr><td class="num"></td><td><strong>Grand total</strong></td><td class="num"></td>' +
          nc(d.table2.total.received) + nc(d.table2.total.resolved) + '<td class="num"></td></tr>';
        $('cdT2Body').innerHTML = t2;

        var t3 = '';
        d.table3.rows.forEach(function(r, i){
          t3 += '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r.year) + '</td>' +
            nc(r.carried) + nc(r.received) + nc(r.resolved) + nc(r.pending) + '</tr>';
        });
        t3 += '<tr><td class="num"></td><td><strong>Grand total</strong></td><td class="num"></td>' +
          nc(d.table3.total.received) + nc(d.table3.total.resolved) + '<td class="num"></td></tr>';
        $('cdT3Body').innerHTML = t3;

        if($('cdAsOf')) $('cdAsOf').textContent = 'Last updated ' + d.generatedAt + '.';
        if(loading) loading.style.display = 'none';
        hide($('cdError'));
        wrap.hidden = false;
      })
      .catch(fail);
  }

  /* ============================================================
     RESOURCES — filter by topic + reading time, sort by date
     ============================================================ */
  function initResourceFilters(){
    var grid = $('resGrid');
    if(!grid) return;
    var chips = Array.prototype.slice.call(document.querySelectorAll('#topicChips .chip'));
    var readSel = $('readFilter');
    var dateSel = $('dateSort');
    var perSel  = $('perPage');
    var empty   = $('resEmpty');
    var reset   = $('resReset');
    var pager   = $('resPager');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.res-card'));
    var topic = 'all';
    var page = 1;

    function matching(){
      var list = cards.filter(function(c){
        var okTopic = topic === 'all' || c.getAttribute('data-category') === topic;
        var mins = parseInt(c.getAttribute('data-minutes'), 10) || 0;
        var rf = readSel ? readSel.value : 'any';
        var okRead = rf === 'any' || (rf === 'short' && mins <= 5) || (rf === 'long' && mins >= 6);
        return okTopic && okRead;
      });
      var order = (dateSel && dateSel.value) || 'newest';
      list.sort(function(a, b){
        var ta = parseInt(a.getAttribute('data-ts'), 10) || 0;
        var tb = parseInt(b.getAttribute('data-ts'), 10) || 0;
        return order === 'oldest' ? ta - tb : tb - ta;
      });
      return list;
    }

    function pageList(cur, total){
      if(total <= 7){
        var a = [];
        for(var k = 1; k <= total; k++) a.push(k);
        return a;
      }
      var out = [];
      for(var i = 1; i <= total; i++){
        if(i === 1 || i === total || (i >= cur - 1 && i <= cur + 1)) out.push(i);
        else if(out[out.length - 1] !== '...') out.push('...');
      }
      return out;
    }

    function gotoPage(p){
      page = p;
      apply();
      var top = grid.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }

    function renderPager(totalPages){
      if(!pager) return;
      pager.innerHTML = '';
      if(totalPages <= 1) return;
      function addBtn(label, target, current, disabled){
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        if(current) b.className = 'is-current';
        if(disabled) b.disabled = true;
        if(!disabled && !current) b.addEventListener('click', function(){ gotoPage(target); });
        pager.appendChild(b);
      }
      addBtn('‹', page - 1, false, page === 1);
      pageList(page, totalPages).forEach(function(p){
        if(p === '...'){
          var s = document.createElement('span');
          s.className = 'ellipsis';
          s.textContent = '…';
          pager.appendChild(s);
        } else {
          addBtn(String(p), p, p === page, false);
        }
      });
      addBtn('›', page + 1, false, page === totalPages);
    }

    function apply(){
      var list = matching();
      var per = perSel ? perSel.value : '9';
      var all = per === 'all';
      var n = all ? (list.length || 1) : parseInt(per, 10);
      var totalPages = (all || list.length === 0) ? 1 : Math.ceil(list.length / n);
      if(page > totalPages) page = totalPages;
      if(page < 1) page = 1;
      var start = all ? 0 : (page - 1) * n;
      var end = all ? list.length : start + n;
      var pageItems = list.slice(start, end);

      cards.forEach(function(c){ c.style.display = 'none'; });
      list.forEach(function(c){ grid.appendChild(c); });            /* keep matching cards in sorted order */
      pageItems.forEach(function(c){ c.style.display = ''; });
      if(empty) empty.style.display = list.length ? 'none' : 'block';
      renderPager(totalPages);
    }

    function resetToFirst(){ page = 1; apply(); }

    chips.forEach(function(ch){
      ch.addEventListener('click', function(){
        chips.forEach(function(x){ x.classList.remove('is-active'); });
        ch.classList.add('is-active');
        topic = ch.getAttribute('data-topic');
        resetToFirst();
      });
    });
    if(readSel) readSel.addEventListener('change', resetToFirst);
    if(dateSel) dateSel.addEventListener('change', resetToFirst);
    if(perSel)  perSel.addEventListener('change', resetToFirst);
    if(reset) reset.addEventListener('click', function(){
      topic = 'all';
      chips.forEach(function(x){ x.classList.toggle('is-active', x.getAttribute('data-topic') === 'all'); });
      if(readSel) readSel.value = 'any';
      if(dateSel) dateSel.value = 'newest';
      if(perSel)  perSel.value = '9';
      resetToFirst();
    });
    apply();
  }

  /* -------- Year -------- */
  var yearEl = $('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  /* -------- Init -------- */
  wireClearOnInput(['cName','cEmail','cPhone','cMsg','gName','gEmail','gPhone','gMsg']);
  onScroll();
  observeReveals(document);
  renderComplaintsData();
  initResourceFilters();
})();
