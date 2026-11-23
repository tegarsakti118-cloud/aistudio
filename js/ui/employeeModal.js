(function (Nexora) {
  'use strict';

  let activeEmployeeId = null;

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));
  const modal = () => document.getElementById('employee-modal');
  const backdrop = () => document.getElementById('employee-modal-backdrop');

  function setButtonEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle('opacity-45', !enabled);
    btn.classList.toggle('cursor-not-allowed', !enabled);
    btn.classList.toggle('active:scale-95', enabled);
  }

  function open(empId) {
    const emp = Nexora.state.getEmployee(empId);
    if (!emp) return;

    activeEmployeeId = empId;
    Nexora.state.selectedEmployeeId = empId;
    renderModalContent(emp);

    backdrop().classList.remove('hidden');
    const el = modal();
    el.classList.remove('translate-y-full', 'sm:translate-x-[120%]');
    el.setAttribute('aria-hidden', 'false');
    if ('inert' in el) el.inert = false;
  }

  function close() {
    activeEmployeeId = null;
    backdrop().classList.add('hidden');
    const el = modal();
    el.classList.add('translate-y-full', 'sm:translate-x-[120%]');
    el.setAttribute('aria-hidden', 'true');
    if ('inert' in el) el.inert = true;
  }

  function renderModalContent(emp) {
    const S = Nexora.STATUS;
    const stStyle = Nexora.STATUS_STYLE[emp.status] || Nexora.STATUS_STYLE['Standby'];

    const avatar = document.getElementById('modal-avatar');
    avatar.style.backgroundColor = emp.avatarColor;
    avatar.textContent = emp.name.slice(0, 2);

    document.getElementById('modal-name').textContent = emp.name;
    document.getElementById('modal-role').textContent = `${emp.role} • ${emp.zone}`;

    const badge = document.getElementById('modal-status-badge');
    badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${stStyle.badgeClass}`;
    badge.textContent = emp.status;

    document.getElementById('modal-current-task').textContent = emp.currentTask;
    document.getElementById('modal-progress-pct').textContent = `${emp.progress}%`;
    document.getElementById('modal-progress-bar').style.width = `${emp.progress}%`;
    document.getElementById('modal-output-box').textContent = emp.lastOutput;
    document.getElementById('modal-personality').textContent = emp.personality;

    document.getElementById('modal-skills').innerHTML = emp.skills
      .map((s) => `<li>${esc(s)}</li>`)
      .join('');

    document.getElementById('modal-history').innerHTML = emp.history
      .slice(0, 8)
      .map(
        (h) => `
        <div class="flex items-start justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
          <span class="text-slate-700">${esc(h.text)}</span>
          <span class="text-[10px] text-slate-400 shrink-0">${esc(h.time)}</span>
        </div>
      `
      )
      .join('');

    const isBusy = emp.status === S.WORKING || emp.status === S.REVIEWING;
    const isWaiting = emp.status === S.WAITING_APPROVAL;
    const isStandby = emp.status === S.STANDBY;
    const isFailed = emp.status === S.FAILED;

    const btnStart = document.getElementById('btn-emp-start');
    const btnStop = document.getElementById('btn-emp-stop');
    const btnApprove = document.getElementById('btn-emp-approve');
    const btnReject = document.getElementById('btn-emp-reject');

    btnStart.textContent = isFailed ? '↻ Revisi Tugas' : '▶ Mulai Tugas';
    setButtonEnabled(btnStart, !isBusy && !isWaiting);
    setButtonEnabled(btnStop, !isStandby);
    setButtonEnabled(btnApprove, isWaiting);
    setButtonEnabled(btnReject, isWaiting);

    btnApprove.classList.toggle('ring-2', isWaiting);
    btnApprove.classList.toggle('ring-amber-400', isWaiting);
  }

  function init() {
    document.getElementById('btn-close-employee-modal').addEventListener('click', close);
    backdrop().addEventListener('click', close);

    document.getElementById('btn-emp-start').addEventListener('click', () => {
      if (activeEmployeeId) Nexora.state.startEmployeeTask(activeEmployeeId);
    });

    document.getElementById('btn-emp-stop').addEventListener('click', () => {
      if (activeEmployeeId) Nexora.state.stopEmployeeTask(activeEmployeeId);
    });

    document.getElementById('btn-emp-approve').addEventListener('click', () => {
      if (activeEmployeeId) Nexora.state.approveEmployeeWork(activeEmployeeId);
    });

    document.getElementById('btn-emp-reject').addEventListener('click', () => {
      if (activeEmployeeId) Nexora.state.rejectEmployeeWork(activeEmployeeId);
    });

    document.getElementById('form-emp-instruction').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-emp-instruction');
      if (activeEmployeeId && input.value.trim()) {
        Nexora.state.sendInstruction(activeEmployeeId, input.value);
        input.value = '';
      }
    });

    Nexora.state.subscribe(() => {
      if (activeEmployeeId) {
        const emp = Nexora.state.getEmployee(activeEmployeeId);
        if (emp) renderModalContent(emp);
      }
    });
  }

  Nexora.employeeModal = { init, open, close };

})(window.Nexora = window.Nexora || {});