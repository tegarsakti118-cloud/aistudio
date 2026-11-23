(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  function render() {
    const wf = Nexora.workflowEngine;
    if (!wf) return;

    const proposals = wf.getAllArtifactsByType('idea_proposals');
    const summaryEl = document.getElementById('idea-bank-summary');
    const listEl = document.getElementById('idea-bank-list');

    if (summaryEl) {
      const waitingCount = wf.projects.filter((p) => p.current_step === 3 && p.status !== 'completed').length;
      summaryEl.textContent = waitingCount > 0
        ? `${waitingCount} batch ide menunggu pilihan Direktur`
        : `${proposals.length} batch ide tersimpan`;
    }

    if (!listEl) return;

    if (proposals.length === 0) {
      listEl.innerHTML = `
        <div class="bg-white rounded-3xl p-6 border border-sky-100 text-center space-y-2.5">
          <p class="text-xs text-slate-500">Belum ada proposal ide dari SARI. Mulai riset dari RAKA di Trend Research atau buat proyek baru di Dashboard.</p>
          <button id="btn-ideabank-to-trend" class="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold">
            🔍 Buka Trend Research
          </button>
        </div>
      `;
      const btnTrend = document.getElementById('btn-ideabank-to-trend');
      if (btnTrend) {
        btnTrend.addEventListener('click', () => Nexora.navigation.navigateTo('trend-research'));
      }
      return;
    }

    listEl.innerHTML = proposals
      .map(({ project, artifact }) => {
        const c = artifact.content || {};
        const ideas = Array.isArray(c.ideas) ? c.ideas : [];
        const isWaitingSelection = project.current_step === 3 && project.status !== 'completed';
        const isLive = artifact.source_mode === 'live_ai';
        const selectedTitle = project.selected_idea && project.selected_idea.title ? project.selected_idea.title : null;

        const cardsHtml = ideas
          .map((idea, idx) => {
            const isChosen = selectedTitle && idea.title === selectedTitle;
            const score = Number(idea.potential_score || 85);
            const scoreColor = score >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700';

            return `
              <div class="p-3.5 rounded-2xl border ${
                isChosen ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/70'
              } flex flex-col justify-between gap-2.5">
                <div class="space-y-1.5">
                  <div class="flex items-start justify-between gap-2">
                    <h5 class="text-xs font-extrabold text-slate-900 leading-snug">${esc(idea.title || 'Tanpa Judul')}</h5>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${scoreColor}">
                      Skor ${esc(score)}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-600"><strong>Angle:</strong> ${esc(idea.angle || '-')}</p>
                  <p class="text-[11px] text-slate-500"><strong>Audiens:</strong> ${esc(idea.audience || '-')}</p>
                </div>

                ${
                  isWaitingSelection
                    ? `<button data-pick-proj="${esc(project.id)}" data-pick-idx="${idx}" ${wf.isStepRunning ? 'disabled' : ''}
                        class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition ${
                          wf.isStepRunning ? 'opacity-50 cursor-not-allowed' : ''
                        }">
                        ✓ Pilih Ide Ini → Kirim ke BIMA
                      </button>`
                    : isChosen
                      ? `<div class="text-center py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold">✓ Dipilih Direktur</div>`
                      : ''
                }
              </div>
            `;
          })
          .join('');

        return `
          <div class="bg-white rounded-3xl p-4 border border-sky-100 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h4 class="text-sm font-extrabold text-slate-900">${esc(project.title)}</h4>
                <p class="text-[11px] text-slate-500">Niche: ${esc(project.niche)} • Versi #${esc(artifact.version)}</p>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }">${isLive ? 'Live AI' : 'Simulasi'}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isWaitingSelection ? 'bg-amber-100 text-amber-800' : 'bg-sky-50 text-sky-700'
                }">${isWaitingSelection ? 'Menunggu Pilihan Direktur' : `Langkah ${esc(project.current_step)}/12`}</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              ${cardsHtml || '<p class="text-xs text-slate-400">Tidak ada item ide pada batch ini.</p>'}
            </div>

            ${
              isWaitingSelection
                ? `<div class="flex justify-end pt-1">
                    <button data-reject-ideas="${esc(project.id)}" ${wf.isStepRunning ? 'disabled' : ''}
                      class="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold active:scale-95 transition">
                      ✕ Minta SARI Buat Ide Ulang
                    </button>
                  </div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-pick-proj]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const projId = btn.getAttribute('data-pick-proj');
        const idx = Number(btn.getAttribute('data-pick-idx'));
        wf.selectIdeaAndApprove(projId, idx);
      });
    });

    listEl.querySelectorAll('[data-reject-ideas]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const projId = btn.getAttribute('data-reject-ideas');
        wf.setActiveProject(projId);
        wf.rejectCurrentGate('Direktur meminta variasi sudut pandang ide baru dari SARI.');
      });
    });
  }

  function init() {
    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.ideaBankView = { init, render };

})(window.Nexora = window.Nexora || {});