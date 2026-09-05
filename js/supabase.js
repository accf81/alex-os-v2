// ─── ALEX OS v2 — Conexão Supabase ───────────────────────────────────────────
// Arquivo compartilhado por todos os módulos. Não editar manualmente.

const SUPABASE_URL = 'https://sobmjqounukzbplrmhkr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_o5fTXnmp8hhp76WymPJ_MQ_MuJUhvfY';

async function initSupabase() {
  if (window._sb) return window._sb;
  const { createClient } = supabase;
  window._sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return window._sb;
}

function db() {
  if (!window._sb) throw new Error('Supabase não inicializado.');
  return window._sb;
}

// ─── Utilitários globais ──────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtMoeda(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtData(s) { if(!s)return'—'; const[y,m,d]=s.split('-'); return`${d}/${m}/${y}`; }
function fmtTS(ts) { const d=new Date(ts); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
