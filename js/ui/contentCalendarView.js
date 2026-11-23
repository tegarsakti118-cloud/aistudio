(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  let activeFilter = 'ALL';

  function statusBadgeClass(status) {
    if (status === 'Posted') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Ready') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-sky-100 text-sky-700 border-sky-200';
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function render() {
    const wf = Nexora.workflowEngine;
    const vr = Nexora.videoRenderer;
    if (!wf) return;

    const allEntries = wf.getCalendarEntries();
    const summaryPill = document.getElementById('calendar-summary-pill');
    if (summaryPill) {
      const readyCount = allEntries.filter((e) => e.schedule.status === 'Ready').length;
      const postedCount = allEntries.filter((e) => e.schedule.status === 'Posted').length;
      summaryPill.textContent = `${readyCount} Siap Post • ${postedCount} Terbit`;
    }

    const tabsEl = document.getElementById('calendar-filter-tabs');
    if (tabsEl) {
      const tabs = [
        { id: 'ALL', label: `Semua (${allEntries.length})` },
        { id: 'Planned', label: `Terjadwal (${allEntries.filter((e) => e.schedule.status === 'Planned').length})` },
        { id: 'Ready', label: `Siap Post (${allEntries.filter((e) => e.schedule.status === 'Ready').length})` },
        { id: 'Posted', label: `Sudah Post (${allEntries.filter((e) => e.schedule.status === 'Posted').length})` }
      ];

      tabsEl.innerHTML = tabs
        .map(
          (t) => `
        <button data-cal-filter="${t.id}"
          class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            activeFilter === t.id
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }">
          ${esc(t.label)}
        </button>
      `
        )
        .join('');

      tabsEl.querySelectorAll('[data-cal-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFilter = btn.getAttribute('data-cal-filter');
          render();
        });
      });
    }

    const listEl = document.getElementById('calendar-list');
    if (!listEl) return;

    const filtered = activeFilter === 'ALL'
      ? allEntries
      : allEntries.filter((e) => e.schedule.status === activeFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="bg-white rounded-3xl p-6 border border-sky-100 text-center text-xs text-slate-500">
          Belum ada konten pada filter ini. Buat proyek konten di Dashboard atau Trend Research terlebih dahulu.
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map(({ project, schedule }) => {
        const arts = wf.getProjectArtifacts(project.id);
        const melArt = arts.find((a) => a.employee_id === 'mel');
        const hasScript = Boolean(project.final_script || arts.some((a) => a.employee_id === 'bima'));
        const rendered = vr ? vr.getRenderedVideo(project.id) : null;
        const pubPkg = project.publish_package || (melArt ? melArt.content : null);
        const isReadyToPost = project.current_step === 10;

        return `
          <div class="calendar-item bg-white rounded-3xl p-4 border border-sky-100 shadow-sm space-y-3" data-proj-id="${esc(project.id)}">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 class="text-sm font-extrabold text-slate-900">${esc(project.title)}</h4>
                <p class="text-[11px] text-slate-500">${esc(project.niche)} • Progress Langkah ${esc(project.current_step)}/12</p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadgeClass(schedule.status)}">
                ${esc(schedule.status)}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div class="sm:col-span-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">Tanggal Tayang</label>
                <input type="date" value="${esc(schedule.date)}" class="cal-date w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs" />
              </div>
              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">Jam (WIB)</label>
                <input type="time" value="${esc(schedule.time)}" class="cal-time w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs" />
              </div>
              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">Platform</label>
                <select class="cal-platform w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs">
                  <option value="TikTok / Reels / Shorts" ${schedule.platform === 'TikTok / Reels / Shorts' ? 'selected' : ''}>TikTok / Reels / Shorts</option>
                  <option value="Instagram Reels" ${schedule.platform === 'Instagram Reels' ? 'selected' : ''}>Instagram Reels</option>
                  <option value="YouTube Shorts" ${schedule.platform === 'YouTube Shorts' ? 'selected' : ''}>YouTube Shorts</option>
                </select>
              </div>
              <div class="sm:col-span-2 flex items-end">
                <button type="button" data-save-schedule="${esc(project.id)}"
                  class="w-full py-1.5 px-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold active:scale-95 transition">
                  Simpan
                </button>
              </div>
            </div>

            ${
              pubPkg
                ? `<div class="p-3 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs space-y-1.5">
                    <div class="font-bold text-sky-800">📢 Paket Publikasi MEL (${esc(pubPkg.recommended_slot || schedule.time)}):</div>
                    <p class="text-slate-700 whitespace-pre-line">${esc(pubPkg.final_caption || '')}</p>
                    <p class="text-sky-700 font-semibold">${esc(Array.isArray(pubPkg.hashtags) ? pubPkg.hashtags.join(' ') : '')}</p>
                  </div>`
                : ''
            }

            <div class="flex flex-wrap gap-2 justify-end">
              ${
                rendered
                  ? `<button type="button" data-download-cal-vid="${esc(project.id)}"
                      class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold active:scale-95">
                      ⬇️ Download Video (${esc(rendered.ext.toUpperCase())})
                    </button>`
                  : hasScript
                    ? `<button type="button" data-goto-render="${esc(project.id)}"
                        class="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold active:scale-95">
                        🎬 Render Video Dulu
                      </button>`
                    : ''
              }
              ${
                pubPkg
                  ? `<button type="button" data-copy-cal="${esc(project.id)}"
                      class="px-3 py-1.5 rounded-xl bg-sky-100 text-sky-800 text-xs font-bold active:scale-95">
                      📋 Salin Caption
                    </button>`
                  : ''
              }
              ${
                isReadyToPost
                  ? `<button type="button" data-confirm-post="${esc(project.id)}" ${wf.isStepRunning ? 'disabled' : ''}
                      class="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95">
                      ✓ Tandai Sudah Diposting → Analisis DINA
                    </button>`
                  : `<button type="button" data-open-dash="${esc(project.id)}"
                      class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95">
                      📊 Lihat Pipeline
                    </button>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-save-schedule]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-save-schedule');
        const card = btn.closest('.calendar-item');
        if (!card) return;
        wf.setProjectSchedule(pid, {
          date: card.querySelector('.cal-date').value,
          time: card.querySelector('.cal-time').value,
          platform: card.querySelector('.cal-platform').value
        });
        Nexora.notificationsUI.showToast('Jadwal publikasi diperbarui.', 'success');
      });
    });

    listEl.querySelectorAll('[data-download-cal-vid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-download-cal-vid');
        const rendered = vr ? vr.getRenderedVideo(pid) : null;
        const proj = wf.projects.find((p) => p.id === pid);
        if (!rendered) return;
        const safeName = (proj ? proj.title : 'nexora-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        triggerDownload(rendered.url, `${safeName}.${rendered.ext}`);
      });
    });

    listEl.querySelectorAll('[data-goto-render]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wf.setActiveProject(btn.getAttribute('data-goto-render'));
        Nexora.navigation.navigateTo('video-production');
      });
    });

    listEl.querySelectorAll('[data-copy-cal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-copy-cal');
        const proj = wf.projects.find((p) => p.id === pid);
        const melArt = wf.getProjectArtifacts(pid).find((a) => a.employee_id === 'mel');
        const pubPkg = (proj && proj.publish_package) || (melArt ? melArt.content : null);
        if (!pubPkg) return;
        const text = `${pubPkg.final_caption || ''}\n\n${Array.isArray(pubPkg.hashtags) ? pubPkg.hashtags.join(' ') : ''}`.trim();
        try {
          await navigator.clipboard.writeText(text);
          Nexora.notificationsUI.showToast('Caption & hashtag disalin!', 'success');
        } catch (err) {
          Nexora.notificationsUI.showToast('Silakan salin manual dari kotak paket publikasi.', 'info');
        }
      });
    });

    listEl.querySelectorAll('[data-confirm-post]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-confirm-post');
        wf.setActiveProject(pid);
        await wf.approveCurrentGate('Diposting manual via Content Calendar');
      });
    });

    listEl.querySelectorAll('[data-open-dash]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wf.setActiveProject(btn.getAttribute('data-open-dash'));
        Nexora.navigation.navigateTo('dashboard');
      });
    });
  }

  function init() {
    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.contentCalendarView = { init, render };

})(window.Nexora = window.Nexora || {});