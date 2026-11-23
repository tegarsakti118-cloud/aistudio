(function (Nexora) {
  'use strict';

  const CONFIG_KEY = 'nexora_supabase_config_v1';

  class SupabaseService {
    constructor() {
      this.client = null;
      this.currentUser = null;
      this.realtimeChannel = null;
      this.config = this.loadConfig();

      if (this.isConfigured()) {
        this.initClient();
      }
    }

    loadConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return { url: '', anonKey: '' };
        const parsed = JSON.parse(raw);
        return {
          url: typeof parsed.url === 'string' ? parsed.url.trim() : '',
          anonKey: typeof parsed.anonKey === 'string' ? parsed.anonKey.trim() : ''
        };
      } catch (err) {
        return { url: '', anonKey: '' };
      }
    }

    saveConfig(url, anonKey) {
      const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
      const cleanKey = String(anonKey || '').trim();
      this.config = { url: cleanUrl, anonKey: cleanKey };
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
      } catch (err) {
        // Abaikan error storage
      }
      this.unsubscribeRealtime();
      this.client = null;
      this.currentUser = null;
      return this.initClient();
    }

    clearConfig() {
      this.unsubscribeRealtime();
      this.config = { url: '', anonKey: '' };
      this.client = null;
      this.currentUser = null;
      try {
        localStorage.removeItem(CONFIG_KEY);
      } catch (err) {
        // Abaikan error storage
      }
    }

    getConfig() {
      return { ...this.config };
    }

    isConfigured() {
      return Boolean(this.config.url && this.config.anonKey);
    }

    isSdkLoaded() {
      return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
    }

    initClient() {
      if (!this.isConfigured() || !this.isSdkLoaded()) {
        this.client = null;
        return false;
      }
      try {
        this.client = window.supabase.createClient(this.config.url, this.config.anonKey);
        return true;
      } catch (err) {
        this.client = null;
        return false;
      }
    }

    ensureReady() {
      if (!this.client) {
        this.initClient();
      }
      if (!this.client) {
        throw new Error('Supabase belum dikonfigurasi atau SDK belum dimuat.');
      }
      return this.client;
    }

    // ----------------------------------------------------------
    // AUTHENTICATION (DIREKTUR STUDIO)
    // ----------------------------------------------------------
    async restoreSession() {
      if (!this.isConfigured() || !this.isSdkLoaded()) {
        this.currentUser = null;
        return null;
      }
      const client = this.ensureReady();
      const { data, error } = await client.auth.getSession();
      if (error) {
        this.currentUser = null;
        return null;
      }
      this.currentUser = data.session ? data.session.user : null;
      return this.currentUser;
    }

    async signIn(email, password) {
      const client = this.ensureReady();
      const { data, error } = await client.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || '')
      });
      if (error) throw error;
      this.currentUser = data.user || null;
      return this.currentUser;
    }

    async signUp(email, password) {
      const client = this.ensureReady();
      const { data, error } = await client.auth.signUp({
        email: String(email || '').trim(),
        password: String(password || '')
      });
      if (error) throw error;
      this.currentUser = data.user || null;
      return data;
    }

    async signOut() {
      this.unsubscribeRealtime();
      if (!this.client) {
        this.currentUser = null;
        return;
      }
      const { error } = await this.client.auth.signOut();
      this.currentUser = null;
      if (error) throw error;
    }

    isAuthenticated() {
      return Boolean(this.client && this.currentUser);
    }

    async testConnection() {
      const client = this.ensureReady();
      const { error } = await client.from('ai_employees').select('id').limit(1);
      if (error) throw error;
      return true;
    }

    // ----------------------------------------------------------
    // CONTENT PROJECTS
    // ----------------------------------------------------------
    async listProjects(limit = 20) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('content_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    }

    async createProject({ title, niche, targetPlatform }) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('content_projects')
        .insert({
          title,
          niche: niche || 'AI & Produktivitas',
          target_platform: targetPlatform || 'TikTok / Reels / Shorts',
          current_step: 1,
          status: 'active'
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    async updateProject(projectId, patch) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('content_projects')
        .update(patch)
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // ----------------------------------------------------------
    // AGENT TASKS
    // ----------------------------------------------------------
    async listTasksByProject(projectId) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('agent_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    async createTask(taskPayload) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('agent_tasks')
        .insert(taskPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    async updateTask(taskId, patch) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('agent_tasks')
        .update(patch)
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // ----------------------------------------------------------
    // ARTIFACTS & ACTIVITY LOGS
    // ----------------------------------------------------------
    async saveArtifact(artifactPayload) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('task_artifacts')
        .insert(artifactPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    async listArtifactsByProject(projectId) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('task_artifacts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    async addActivityLog({ projectId = null, actor, level = 'info', message }) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('activity_logs')
        .insert({ project_id: projectId, actor, level, message })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    async listActivityLogs(limit = 30) {
      const client = this.ensureReady();
      const { data, error } = await client
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    }

    // ----------------------------------------------------------
    // REALTIME SUBSCRIPTION
    // ----------------------------------------------------------
    subscribeStudioChanges(onChange) {
      if (!this.client || !this.currentUser) return;
      this.unsubscribeRealtime();

      this.realtimeChannel = this.client
        .channel('nexora-studio-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content_projects' }, (payload) => {
          onChange('content_projects', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks' }, (payload) => {
          onChange('agent_tasks', payload);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
          onChange('activity_logs', payload);
        })
        .subscribe();
    }

    unsubscribeRealtime() {
      if (this.client && this.realtimeChannel) {
        this.client.removeChannel(this.realtimeChannel);
      }
      this.realtimeChannel = null;
    }
  }

  Nexora.supabaseService = new SupabaseService();

})(window.Nexora = window.Nexora || {});