(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  function setStatusMessage(text, isError = false) {
    const el = document.getElementById('settings-feedback-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden', 'text-emerald-700', 'bg-emerald-50', 'border-emerald-200', 'text-rose-700', 'bg-rose-50', 'border-rose-200');
    if (isError) {
      el.classList.add('text-rose-700', 'bg-rose-50', 'border-rose-200');
    } else {
      el.classList.add('text-emerald-700', 'bg-emerald-50', 'border-emerald-200');
    }
  }

  function renderAIUsage() {
    const ai = Nexora.aiService;
    if (!ai) return;

    const toggleEl = document.getElementById('toggle-live-ai');
    const pillEl = document.getElementById('ai-mode-status-pill');
    if (toggleEl) toggleEl.checked = ai.isPreferLiveAI();

    if (pillEl) {
      const liveReady = ai.isLiveAIAvailable();
      pillEl.className = liveReady
        ? 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700'
        : 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700';
      pillEl.textContent = liveReady ? 'Live AI Aktif' : 'Mode Simulasi';
    }

    const summaryEl = document.getElementById('ai-usage-summary');
    const listEl = document.getElementById('ai-usage-list');
    const summary = ai.getUsageSummary();

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-center">
          <div class="text-[10px] font-bold text-slate-500">Panggilan AI</div>
          <div class="text-sm font-extrabold text-sky-700">${esc(summary.totalCalls)}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-center">
          <div class="text-[10px] font-bold text-slate-500">Total Token</div>
          <div class="text-sm font-extrabold text-teal-700">${esc(summary.totalTokens)}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
          <div class="text-[10px] font-bold text-slate-500">Estimasi USD</div>
          <div class="text-sm font-extrabold text-amber-700">$${esc(summary.totalCostUsd)}</div>
        </div>
      `;
    }

    if (listEl) {
      if (!Nexora.supabaseService || !Nexora.supabaseService.isAuthenticated()) {
        listEl.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-3">Login Direktur untuk melihat log token Supabase.</p>';
      } else if (ai.usageLogs.length === 0) {
        listEl.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-3">Belum ada pemanggilan Edge Function AI.</p>';
      } else {
        listEl.innerHTML = ai.usageLogs
          .slice(0, 10)
          .map(
            (u) => `
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div class="min-w-0">
              <span class="font-bold text-sky-700">${esc(String(u.employee_id).toUpperCase())}</span>
              <span class="text-slate-500"> • ${esc(u.provider)}/${esc(u.model)}</span>
            </div>
            <div class="text-right shrink-0 font-mono text-[10px] text-slate-600">
              ${esc(Number(u.prompt_tokens || 0) + Number(u.completion_tokens || 0))} tok • $${esc(u.estimated_cost_usd)}
            </div>
          </div>
        `
          )
          .join('');
      }
    }
  }

  function render() {
    const svc = Nexora.supabaseService;
    if (!svc) return;

    const cfg = svc.getConfig();
    const isConfigured = svc.isConfigured();
    const isAuth = svc.isAuthenticated();

    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-anon-key');
    if (urlInput && !urlInput.value && cfg.url) urlInput.value = cfg.url;
    if (keyInput && !keyInput.value && cfg.anonKey) keyInput.value = cfg.anonKey;

    const badge = document.getElementById('settings-connection-badge');
    const desc = document.getElementById('settings-mode-desc');
    if (badge && desc) {
      if (isAuth) {
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200';
        badge.textContent = 'Cloud Aktif (Supabase + Realtime)';
        desc.textContent = 'Proyek, antrean tugas, log AI, dan aktivitas tersimpan aman di Supabase.';
      } else if (isConfigured) {
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
        badge.textContent = 'Supabase Terpasang • Belum Login';
        desc.textContent = 'Silakan login sebagai Direktur agar kebijakan RLS mengizinkan sinkronisasi cloud & AI Edge Function.';
      } else {
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200';
        badge.textContent = 'Mode Lokal (Browser Storage)';
        desc.textContent = 'Aplikasi berjalan di localStorage. Isi kredensial Supabase untuk mengaktifkan Cloud Database & Live AI.';
      }
    }

    const authForm = document.getElementById('form-director-auth');
    const authLoggedIn = document.getElementById('settings-auth-logged-in');
    const authUserEmail = document.getElementById('auth-user-email');

    if (authForm && authLoggedIn) {
      authForm.classList.toggle('hidden', isAuth);
      authLoggedIn.classList.toggle('hidden', !isAuth);
      if (isAuth && authUserEmail) {
        authUserEmail.textContent = svc.currentUser.email || 'Direktur Studio';
      }
    }

    renderAIUsage();

    const agentsList = document.getElementById('settings-agents-list');
    if (agentsList && Nexora.EMPLOYEES) {
      agentsList.innerHTML = Nexora.EMPLOYEES.map((emp) => {
        const prof = Nexora.getAgentProfile ? Nexora.getAgentProfile(emp.id) : null;
        return `
          <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg text-white text-[11px] font-bold flex items-center justify-center" style="background:${esc(emp.avatarColor)}">
                  ${esc(emp.name.slice(0, 2))}
                </span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900">${esc(emp.name)} • ${esc(emp.role)}</div>
                  <div class="text-[10px] text-slate-500">Handoff: ${esc(prof ? prof.handoffTo.join(', ') : '-')}</div>
                </div>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-700">
                ${esc(prof ? prof.agentType : 'agent')}
              </span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">
              <span class="font-bold text-slate-700">System Prompt:</span> ${esc(prof ? prof.systemPrompt : emp.personality)}
            </p>
            <div class="text-[10px] text-slate-500 font-mono bg-white p-2 rounded-xl border border-slate-100 overflow-x-auto">
              Output: ${esc(prof ? prof.outputContract : '-')}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function init() {
    const formConfig = document.getElementById('form-supabase-config');
    if (formConfig) {
      formConfig.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('input-supabase-url').value;
        const anonKey = document.getElementById('input-supabase-anon-key').value;
        const ok = Nexora.supabaseService.saveConfig(url, anonKey);
        if (ok) {
          setStatusMessage('Konfigurasi Supabase disimpan. Silakan login Direktur atau klik Tes Koneksi.');
          await Nexora.supabaseService.restoreSession();
        } else {
          setStatusMessage('URL atau Anon Key belum valid / SDK Supabase gagal dimuat.', true);
        }
        render();
        if (Nexora.dashboardView) Nexora.dashboardView.render();
      });
    }

    const btnTest = document.getElementById('btn-test-supabase');
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        try {
          await Nexora.supabaseService.testConnection();
          setStatusMessage('Koneksi ke Supabase & tabel ai_employees berhasil!');
        } catch (err) {
          setStatusMessage(`Tes koneksi gagal: ${err.message}`, true);
        }
      });
    }

    const btnClear = document.getElementById('btn-clear-supabase');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        Nexora.supabaseService.clearConfig();
        document.getElementById('input-supabase-url').value = '';
        document.getElementById('input-supabase-anon-key').value = '';
        setStatusMessage('Koneksi Supabase dihapus. Studio kembali menggunakan Mode Lokal.');
        render();
        if (Nexora.dashboardView) Nexora.dashboardView.render();
      });
    }

    const btnSignIn = document.getElementById('btn-auth-signin');
    if (btnSignIn) {
      btnSignIn.addEventListener('click', async () => {
        const email = document.getElementById('input-auth-email').value;
        const password = document.getElementById('input-auth-password').value;
        try {
          await Nexora.supabaseService.signIn(email, password);
          setStatusMessage('Login Direktur berhasil! Menyinkronkan data dari Supabase...');
          await Nexora.workflowEngine.syncFromCloud();
          render();
          if (Nexora.dashboardView) Nexora.dashboardView.render();
          if (Nexora.trendResearchView) Nexora.trendResearchView.render();
        } catch (err) {
          setStatusMessage(`Login gagal: ${err.message}`, true);
        }
      });
    }

    const btnSignUp = document.getElementById('btn-auth-signup');
    if (btnSignUp) {
      btnSignUp.addEventListener('click', async () => {
        const email = document.getElementById('input-auth-email').value;
        const password = document.getElementById('input-auth-password').value;
        try {
          const res = await Nexora.supabaseService.signUp(email, password);
          if (res.session) {
            setStatusMessage('Akun Direktur terdaftar & langsung aktif!');
            await Nexora.workflowEngine.syncFromCloud();
          } else {
            setStatusMessage('Pendaftaran berhasil. Cek email Anda untuk verifikasi jika diaktifkan di Supabase.');
          }
          render();
        } catch (err) {
          setStatusMessage(`Daftar gagal: ${err.message}`, true);
        }
      });
    }

    const btnSignOut = document.getElementById('btn-auth-signout');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', async () => {
        try {
          await Nexora.supabaseService.signOut();
          setStatusMessage('Logout berhasil. Studio kembali ke Mode Lokal.');
          render();
          if (Nexora.dashboardView) Nexora.dashboardView.render();
          if (Nexora.trendResearchView) Nexora.trendResearchView.render();
        } catch (err) {
          setStatusMessage(`Logout gagal: ${err.message}`, true);
        }
      });
    }

    const toggleLiveAI = document.getElementById('toggle-live-ai');
    if (toggleLiveAI) {
      toggleLiveAI.addEventListener('change', (e) => {
        if (Nexora.aiService) {
          Nexora.aiService.setPreferLiveAI(e.target.checked);
          renderAIUsage();
          if (Nexora.trendResearchView) Nexora.trendResearchView.render();
        }
      });
    }

    const btnRefreshUsage = document.getElementById('btn-refresh-ai-usage');
    if (btnRefreshUsage) {
      btnRefreshUsage.addEventListener('click', async () => {
        if (!Nexora.aiService) return;
        try {
          await Nexora.aiService.fetchUsageLogs(20);
          renderAIUsage();
          setStatusMessage('Log penggunaan token AI diperbarui.');
        } catch (err) {
          setStatusMessage(`Gagal memuat log token: ${err.message}`, true);
        }
      });
    }

    render();
  }

  Nexora.settingsView = { init, render };

})(window.Nexora = window.Nexora || {});