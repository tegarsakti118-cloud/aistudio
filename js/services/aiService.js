(function (Nexora) {
  'use strict';

  const AI_PREF_KEY = 'nexora_ai_pref_v1';
  const EDGE_FUNCTION_NAME = 'nexora-ai-agent';

  class AIService {
    constructor() {
      this.prefs = this.loadPrefs();
      this.usageLogs = [];
    }

    loadPrefs() {
      try {
        const raw = localStorage.getItem(AI_PREF_KEY);
        if (!raw) return { preferLiveAI: true };
        const parsed = JSON.parse(raw);
        return {
          preferLiveAI: typeof parsed.preferLiveAI === 'boolean' ? parsed.preferLiveAI : true
        };
      } catch (err) {
        return { preferLiveAI: true };
      }
    }

    savePrefs(nextPrefs) {
      this.prefs = { ...this.prefs, ...nextPrefs };
      try {
        localStorage.setItem(AI_PREF_KEY, JSON.stringify(this.prefs));
      } catch (err) {
        // Abaikan error storage
      }
    }

    isPreferLiveAI() {
      return Boolean(this.prefs.preferLiveAI);
    }

    setPreferLiveAI(enabled) {
      this.savePrefs({ preferLiveAI: Boolean(enabled) });
    }

    isLiveAIAvailable() {
      return Boolean(
        this.isPreferLiveAI() &&
        Nexora.supabaseService &&
        Nexora.supabaseService.isAuthenticated()
      );
    }

    async runAgent({ employeeId, projectId = null, taskId = null, stepOrder = 1, taskTitle = '', inputPayload = {}, revisionNotes = null }) {
      const svc = Nexora.supabaseService;
      if (!svc || !svc.isAuthenticated()) {
        throw new Error('Login Direktur di Supabase diperlukan untuk menjalankan AI Live.');
      }

      const client = svc.ensureReady();
      const { data, error } = await client.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          employeeId,
          projectId,
          taskId,
          stepOrder,
          taskTitle,
          inputPayload,
          revisionNotes
        }
      });

      if (error) {
        throw new Error(error.message || 'Gagal memanggil Supabase Edge Function.');
      }
      if (!data || data.error) {
        throw new Error((data && data.error) || 'Respon AI Edge Function tidak valid.');
      }

      return data;
    }

    async fetchUsageLogs(limit = 20) {
      const svc = Nexora.supabaseService;
      if (!svc || !svc.isAuthenticated()) {
        this.usageLogs = [];
        return [];
      }

      const client = svc.ensureReady();
      const { data, error } = await client
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      this.usageLogs = data || [];
      return this.usageLogs;
    }

    getUsageSummary() {
      const totalCalls = this.usageLogs.length;
      let totalTokens = 0;
      let totalCostUsd = 0;

      this.usageLogs.forEach((row) => {
        totalTokens += Number(row.prompt_tokens || 0) + Number(row.completion_tokens || 0);
        totalCostUsd += Number(row.estimated_cost_usd || 0);
      });

      return {
        totalCalls,
        totalTokens,
        totalCostUsd: totalCostUsd.toFixed(5)
      };
    }
  }

  Nexora.aiService = new AIService();

})(window.Nexora = window.Nexora || {});