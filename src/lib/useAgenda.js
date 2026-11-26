import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';

async function fetchAll(table, order) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table).select('*').order(order, { ascending: true }).range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) return out;
  }
}

const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';

export function useAgenda(userId) {
  const cacheKey = `agenda-cache-${userId}`;
  const [data, setData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey)) || { clients: [], appointments: [], settings: null };
    } catch {
      return { clients: [], appointments: [], settings: null };
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [clients, appointments, s] = await Promise.all([
        fetchAll('clients', 'name'),
        fetchAll('appointments', 'start_at'),
        supabase.from('settings').select('*').maybeSingle()
      ]);
      if (s.error) throw s.error;
      let settings = s.data;
      const tz = deviceTz();
      if (!settings) {
        const r = await supabase.from('settings').insert({ user_id: userId, timezone: tz }).select().single();
        if (r.error) throw r.error;
        settings = r.data;
      } else if (settings.timezone !== tz) {
        // los recordatorios del servidor siguen la zona horaria del dispositivo
        const r = await supabase.from('settings').update({ timezone: tz }).eq('user_id', userId).select().single();
        if (!r.error) settings = r.data;
      }
      const next = { clients, appointments, settings };
      setData(next);
      setError(null);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* lleno */ }
    } catch (e) {
      setError(navigator.onLine ? e.message || 'Error al cargar' : 'Sin conexión: mostrando la última copia guardada');
    } finally {
      setLoading(false);
    }
  }, [userId, cacheKey]);

  const scheduleLoad = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`agenda-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${userId}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` }, scheduleLoad)
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && scheduleLoad();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', scheduleLoad);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', scheduleLoad);
      clearTimeout(timer.current);
    };
  }, [userId, load, scheduleLoad]);

  // ---------- acciones ----------
  const check = (r) => {
    if (r.error) throw new Error(navigator.onLine ? r.error.message : 'Sin conexión a internet. Intenta de nuevo.');
    return r.data;
  };

  const saveClient = async (client) => {
    const { id, created_at, updated_at, ...fields } = client;
    const row = id
      ? check(await supabase.from('clients').update(fields).eq('id', id).select().single())
      : check(await supabase.from('clients').insert({ ...fields, user_id: userId }).select().single());
    setData((d) => ({
      ...d,
      clients: [...d.clients.filter((c) => c.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }));
    return row;
  };

  const deleteClient = async (id) => {
    check(await supabase.from('clients').delete().eq('id', id).select());
    setData((d) => ({
      ...d,
      clients: d.clients.filter((c) => c.id !== id),
      appointments: d.appointments.map((a) => (a.client_id === id ? { ...a, client_id: null } : a))
    }));
  };

  const saveAppointment = async (appt) => {
    const { id, created_at, updated_at, ...fields } = appt;
    const row = id
      ? check(await supabase.from('appointments').update(fields).eq('id', id).select().single())
      : check(await supabase.from('appointments').insert({ ...fields, user_id: userId }).select().single());
    setData((d) => ({
      ...d,
      appointments: [...d.appointments.filter((a) => a.id !== row.id), row].sort((a, b) => a.start_at.localeCompare(b.start_at))
    }));
    return row;
  };

  const deleteAppointment = async (id) => {
    check(await supabase.from('appointments').delete().eq('id', id).select());
    setData((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== id) }));
  };

  const saveSettings = async (patch) => {
    const row = check(await supabase.from('settings').update(patch).eq('user_id', userId).select().single());
    setData((d) => ({ ...d, settings: row }));
    return row;
  };

  return { ...data, loading, error, reload: load, saveClient, deleteClient, saveAppointment, deleteAppointment, saveSettings };
}
