(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  function showToast(message, level = 'info', employeeId = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const palette = {
      success: 'bg-emerald-600 text-white border-emerald-400',
      warning: 'bg-amber-500 text-white border-amber-300',
      error: 'bg-rose-600 text-white border-rose-400',
      info: 'bg-sky-700 text-white border-sky-400'
    };

    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto px-3.5 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center justify-between gap-2 ${palette[level] || palette.info}`;
    toast.innerHTML = `
      <span class="leading-snug">${esc(message)}</span>
      ${employeeId ? '<span class="underline text-[11px] shrink-0 cursor-pointer">Lihat</span>' : ''}
    `;

    if (employeeId) {
      toast.addEventListener('click', () => {
        if (Nexora.employeeModal) Nexora.employeeModal.open(employeeId);
        toast.remove();
      });
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3400);
  }

  function renderNotificationCenter() {
    const state = Nexora.state;
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');

    if (badge) {
      badge.textContent = state.unreadNotifCount > 9 ? '9+' : String(state.unreadNotifCount);
      badge.classList.toggle('hidden', state.unreadNotifCount === 0);
    }

    if (!list) return;
    if (state.notifications.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Belum ada notifikasi baru.</p>';
      return;
    }

    list.innerHTML = state.notifications
      .map(
        (n) => `
      <div class="p-2.5 rounded-xl ${n.read ? 'bg-white' : 'bg-sky-50/80'} hover:bg-slate-50 transition cursor-pointer" data-emp-id="${esc(n.employeeId || '')}">
        <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
          <span class="font-bold uppercase text-sky-600">${esc(n.level)}</span>
          <span>${esc(n.time)}</span>
        </div>
        <p class="text-xs font-medium text-slate-700">${esc(n.message)}</p>
      </div>
    `
      )
      .join('');

    list.querySelectorAll('[data-emp-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const empId = el.getAttribute('data-emp-id');
        if (empId && Nexora.employeeModal) {
          Nexora.employeeModal.open(empId);
          document.getElementById('notif-panel').classList.add('hidden');
        }
      });
    });
  }

  function initNotifications() {
    const btnToggle = document.getElementById('btn-toggle-notif-center');
    const panel = document.getElementById('notif-panel');
    const btnClear = document.getElementById('btn-clear-notifs');

    if (btnToggle && panel) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !btnToggle.contains(e.target)) {
          panel.classList.add('hidden');
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => Nexora.state.markAllNotificationsRead());
    }

    Nexora.state.subscribe((_, eventType, payload) => {
      if (eventType === 'notification' && payload) {
        showToast(payload.message, payload.level, payload.employeeId);
      }
      renderNotificationCenter();
    });

    renderNotificationCenter();
  }

  Nexora.notificationsUI = { init: initNotifications, showToast };

})(window.Nexora = window.Nexora || {});