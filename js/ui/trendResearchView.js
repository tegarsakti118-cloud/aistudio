(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  function render() {
    const wf = Nexora.workflowEngine;
    if (!wf) return;

    const badge = document.getElementById('trend-mode-badge');
    if (badge) {
      const liveReady = Nexora.aiService && Nexora.aiService.isLiveAIAvailable();
      badge.className = liveReady
        ? 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200';
      badge.textContent = liveReady ? 'Live AI (Edge Function)' : 'Simulasi Lokal / Fallback';
    }

    const insightBox = document.getElementById('trend-dina-insight');
    if (insightBox) {
      if (wf.latestFeedback && Array.isArray(wf.latestFeedback.recommendations)) {
        insightBox.classList.remove('hidden');
        insightBox.innerHTML = `
          <div class="font-bold mb-1">📈 Insight Feedback DINA untuk Riset RAKA:</div>
          <ul class="list-disc list-inside space-y-0.5">
            ${wf.latestFeedback.recommendations.map((r) => `<li>${esc(r)}</li>`).join('')}
          </ul>
        `;
      } else {
        insightBox.classList.add('hidden');
      }
    }

    const btnSubmit = document.getElementById('btn-run-trend-research');
    if (btnSubmit) {
      btnSubmit.disabled = wf.isStepRunning;
      btnSubmit.textContent = wf.isStepRunning ? '⏳ RAKA Sedang Riset...' : '🔍 Tugaskan RAKA Riset & Kirim ke SARI';
      btnSubmit.classList.toggle('opacity-60', wf.isStepRunning);
    }

    const resultsEl = document.getElementById('trend-research-results');
    if (!resultsEl) return;

    const reports = wf.getAllArtifactsByType('trend_report');
    if (reports.length === 0) {
      resultsEl.innerHTML = `
        <div class="bg-white rounded-3xl p-6 border border-sky-100 text-center text-xs text-slate-500">
          Belum ada laporan riset tren dari RAKA. Isi niche & kata kunci di atas untuk memulai riset pertama.
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = reports
      .map(({ project, artifact }) => {
        const c = artifact.content || {};
        const trends = Array.isArray(c.trends) ? c.trends : [];
        const competitors = Array.isArray(c.competitors) ? c.competitors : [];
        const opportunities = Array.isArray(c.opportunities) ? c.opportunities : [];
        const isLive = artifact.source_mode === 'live_ai';

        return `
          <div class="bg-white rounded-3xl p-4 border border-sky-100 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h4 class="text-sm font-extrabold text-slate-900">${esc(project.title)}</h4>
                <p class="text-[11px] text-slate-500">Niche: ${esc(c.niche || project.niche)} • ${esc(project.target_platform)}</p>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }">${isLive ? 'Live AI' : 'Simulasi'}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700">
                  Langkah ${esc(project.current_step)}/12
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div class="p-3 rounded-2xl bg-sky-50/70 border border-sky-100">
                <div class="font-bold text-sky-800 mb-1">🔥 Tren Teridentifikasi</div>
                <ul class="list-disc list-inside space-y-1 text-slate-700">
                  ${trends.length ? trends.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>Tidak ada data tren</li>'}
                </ul>
              </div>
              <div class="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                <div class="font-bold text-indigo-800 mb-1">🎯 Analisis Kompetitor</div>
                <ul class="list-disc list-inside space-y-1 text-slate-700">
                  ${competitors.length ? competitors.map((comp) => `<li>${esc(comp)}</li>`).join('') : '<li>Tidak ada data kompetitor</li>'}
                </ul>
              </div>
              <div class="p-3 rounded-2xl bg-teal-50/70 border border-teal-100">
                <div class="font-bold text-teal-800 mb-1">💎 Peluang Konten</div>
                <ul class="list-disc list-inside space-y-1 text-slate-700">
                  ${opportunities.length ? opportunities.map((op) => `<li>${esc(op)}</li>`).join('') : '<li>Tidak ada data peluang</li>'}
                </ul>
              </div>
            </div>

            <div class="flex flex-wrap justify-end gap-2 pt-1">
              <button data-goto-ideas="${esc(project.id)}" class="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold active:scale-95 transition">
                💡 Lihat Ide SARI →
              </button>
              <button data-goto-pipeline="${esc(project.id)}" class="px-3.5 py-1.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold active:scale-95 transition">
                📊 Buka di Dashboard
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    resultsEl.querySelectorAll('[data-goto-ideas]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wf.setActiveProject(btn.getAttribute('data-goto-ideas'));
        Nexora.navigation.navigateTo('idea-bank');
      });
    });

    resultsEl.querySelectorAll('[data-goto-pipeline]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wf.setActiveProject(btn.getAttribute('data-goto-pipeline'));
        Nexora.navigation.navigateTo('dashboard');
      });
    });
  }

  function init() {
    const form = document.getElementById('form-trend-research');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const niche = document.getElementById('input-trend-niche').value;
        const keywords = document.getElementById('input-trend-keywords').value;
        const topic = document.getElementById('input-trend-topic').value;
        const targetPlatform = document.getElementById('select-trend-platform').value;

        await Nexora.workflowEngine.runTrendResearchOnly({
          topic,
          niche,
          keywords,
          targetPlatform
        });

        document.getElementById('input-trend-topic').value = '';
        document.getElementById('input-trend-keywords').value = '';
      });
    }

    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.trendResearchView = { init, render };

})(window.Nexora = window.Nexora || {});