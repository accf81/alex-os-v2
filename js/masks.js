// js/masks.js — Alex OS v2
// Máscaras e validações de campos tipados.
//
// REGRA: qualquer input com dado tipado deve ter data-mask="tel|email|currency|cpf"
// OU ter ID com padrão reconhecido abaixo (auto-detectado no DOMContentLoaded).
//
// Auto-detecção por ID:
//   tel/fone/celular/whatsapp → máscara telefone BR
//   email                     → validação visual de email
//   cpf                       → máscara CPF 000.000.000-00
//   valor/preco/iptu/mensal/comissao/custo/honorario/entrada/saldo/taxa → máscara moeda

// ─── Telefone ────────────────────────────────────────────────────────────────

function applyPhoneMask(el) {
  el.addEventListener('input', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) { this.value = ''; return; }
    if (d.length <= 2)  { this.value = '(' + d; return; }
    if (d.length <= 6)  { this.value = '(' + d.slice(0,2) + ') ' + d.slice(2); return; }
    if (d.length <= 10) {
      // Fixo: (11) 3000-0000
      this.value = '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
    } else {
      // Celular: (11) 9 0000-0000
      this.value = '(' + d.slice(0,2) + ') ' + d.slice(2,3) + ' ' + d.slice(3,7) + '-' + d.slice(7);
    }
  });

  el.addEventListener('blur', function () {
    const d = this.value.replace(/\D/g, '');
    if (d.length > 0 && d.length < 10) {
      this.style.borderColor = 'var(--danger, #ef4444)';
      this.title = 'Telefone incompleto';
    } else {
      this.style.borderColor = '';
      this.title = '';
    }
  });

  el.addEventListener('focus', function () {
    this.style.borderColor = '';
    this.title = '';
  });
}

// ─── Email ───────────────────────────────────────────────────────────────────

function applyEmailMask(el) {
  el.addEventListener('blur', function () {
    const v = this.value.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      this.style.borderColor = 'var(--danger, #ef4444)';
      this.title = 'Email inválido';
    } else {
      this.style.borderColor = '';
      this.title = '';
    }
  });

  el.addEventListener('focus', function () {
    this.style.borderColor = '';
    this.title = '';
  });
}

// ─── CPF ─────────────────────────────────────────────────────────────────────
// Só formata o que a pessoa digita (000.000.000-00). NÃO valida dígito verificador
// — decisão do MVP. O aviso de "CPF pela metade" é regra de tela (usa .field-warn),
// não entra aqui, para a máscara servir a qualquer tela sem impor comportamento.

function fmtCpf(valor) {
  const d = String(valor == null ? '' : valor).replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
  if (d.length > 6) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
  if (d.length > 3) return d.slice(0,3) + '.' + d.slice(3);
  return d;
}

function applyCpfMask(el) {
  if (el.dataset.cpfMask === '1') return;   // não empilhar o mesmo ouvinte duas vezes
  el.dataset.cpfMask = '1';
  el.addEventListener('input', function () { this.value = fmtCpf(this.value); });
  el.setAttribute('inputmode', 'numeric');
  if (el.value) el.value = fmtCpf(el.value);   // valor que já veio do banco também sai formatado
}

// ─── Moeda ───────────────────────────────────────────────────────────────────
// Centraliza a formatação usada em todo o sistema.
// Uso: fmtCurrency(input)  →  aplica máscara no campo
//      parseCurrency(str)  →  converte "R$ 1.500,00" → 1500.00

function applyBrCurrencyMask(el) {
  el.addEventListener('input', function () {
    const raw = this.value.replace(/\D/g, '');
    if (!raw) { this.value = ''; return; }
    const num = parseInt(raw, 10) / 100;
    this.value = 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  el.setAttribute('inputmode', 'numeric');
}

function parseBrCurrency(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Auto-detecção ───────────────────────────────────────────────────────────

const TEL_PATTERN    = /tel|fone|celular|whatsapp|phone/i;
const EMAIL_PATTERN  = /email/i;
const CPF_PATTERN    = /cpf/i;
const CUR_PATTERN    = /valor|preco|price|iptu|mensal|custo|honorario|entrada|saldo|taxa|venda/i;
// Campo de observação/anotação (ID termina em "Obs") é sempre texto livre — nunca auto-detectar
// como tel/email/moeda, mesmo que o nome do campo contenha uma dessas palavras no meio
// (ex.: fHistPrecoObs contém "Preco", mas é a observação do histórico de preço, não um valor).
const OBS_SUFFIX     = /Obs$/;

function applyMasks(root) {
  const scope = root || document;
  scope.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"]').forEach(el => {
    const id   = el.id   || '';
    const mask = el.dataset.mask || '';
    const isObsField = !mask && OBS_SUFFIX.test(id);

    if (mask === 'tel'      || (!mask && !isObsField && TEL_PATTERN.test(id)))   applyPhoneMask(el);
    if (mask === 'email'    || (!mask && !isObsField && EMAIL_PATTERN.test(id))) applyEmailMask(el);
    if (mask === 'cpf'      || (!mask && !isObsField && CPF_PATTERN.test(id)))   applyCpfMask(el);
    if (mask === 'currency' || (!mask && !isObsField && CUR_PATTERN.test(id) && !el.dataset.hasCurrency)) {
      // Só aplica se o campo não tiver lógica de moeda própria (evita conflito)
      if (!el.oninput && !el.getAttribute('oninput')) applyBrCurrencyMask(el);
    }
  });
}

// Roda automaticamente no load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applyMasks());
} else {
  applyMasks();
}

// Expõe para uso manual (ex: após abrir modal com campos novos)
window.AlexMasks = { applyMasks, applyPhoneMask, applyEmailMask, applyCpfMask, fmtCpf, applyBrCurrencyMask, parseBrCurrency };
