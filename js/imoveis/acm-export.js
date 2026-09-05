// acm-export.js — exportação da apresentação ACM em HTML (extraído de imoveis.html/acm.js em 06/07/2026, item 12.4, extração 7).
// Depende de: core.js (fmtMoeda/fmtMoneyInt), acm.js (currentACM, saveACM).

// ── Export HTML (mockup layout) ─────────────────────────────────────────────
function exportACMHtml() {
  saveACM();
  const acm = currentACM; if (!acm) { toast('⚠️ Nenhum ACM aberto'); return; }
  const cfg = acm.faixas || {};
  const im  = acm.imovel_id ? imoveis.find(x => x.id === acm.imovel_id) : null;

  /* ── formatters ── */
  const R  = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const R2 = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fDate = s => { const mt=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return mt?mt[3]+'/'+mt[2]+'/'+mt[1]:(s||'—'); };
  const hoje    = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const hojeExt = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long', year:'numeric'});
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* ── calculations ── */
  // Descartados (5.9) nunca entram na apresentação exportada — nem nas médias, nem nas listas.
  const vendidosOK     = (acm.vendidos||[]).filter(r=>!r.descartado);
  const concorrentesOK = (acm.concorrentes||[]).filter(c=>!c.descartado);
  const area    = parseFloat(cfg.areaProp)||0;
  const vp      = parseMoney(cfg.valorPretendido);
  const desc    = (parseFloat(cfg.desconto)||10)/100;
  const vendF   = vendidosOK.filter(r=>parseFloat(r.valorM2)>0);
  const concF   = concorrentesOK.filter(r=>parseFloat(r.au)>0&&parseFloat(r.valorPedido)>0);
  const simList = getACMSimList().filter(s=>!s.descartado);
  const medITBI = vendF.length ? vendF.reduce((s,r)=>s+(parseFloat(r.valorM2)||0),0)/vendF.length : 0;
  const medPedM2= concF.length ? concF.reduce((s,r)=>s+(parseFloat(r.valorPedido)||0)/(parseFloat(r.au)||1),0)/concF.length : 0;
  const medVenM2= medPedM2*(1-desc);
  const f1=medVenM2*area, f2=medPedM2*area, f3=medPedM2*1.1*area;
  const rec = parseMoney(cfg.recomendacao)||0;
  const dN=parseInt(cfg.d)||0, sN=parseInt(cfg.s)||0, vN=parseInt(cfg.v)||0;
  const tipStr=[dN?dN+'D':'',sN?sN+'S':'',vN?vN+'V':''].filter(Boolean).join(' · ')||'—';
  const datas=vendF.map(r=>r.data).filter(Boolean).sort();
  const periodo=datas.length>=2?`${fDate(datas[0])} a ${fDate(datas[datas.length-1])}`:(datas[0]?fDate(datas[0]):'—');
  const primeiroNome=(cfg.proprietario||'Proprietário').split(' ')[0];

  const fxTag=val=>{if(!val||!f1)return'—';if(val<=f1)return'Venda Rápida';if(val<=f2)return'Venda Concorrida';if(val<=f3)return'Poucas Chances';return'Fora do Mercado';};
  const fxCls=val=>{if(!val||!f1)return'';if(val<=f1)return'g';if(val<=f2)return'y';return'r';};
  const recCls=fxCls(rec||vp); const recTag=fxTag(rec||vp);

  /* ── ITBI groups ── */
  const ruaKey = s => removeAccentsUpper(s||'').replace(/^(RUA|R|AV|AVENIDA|AL|ALAMEDA|PRACA|PC|TRAVESSA|TV)\.?\s+/,'');
  /* titleRua agora é helper compartilhado em core.js (capitalização do ITBI) — 26/07/2026 */
  const grps={};
  /* 15.31 (02/08/2026): agrupa e titula pelo nome ARRUMADO da rua (ruaExib), não pelo cru.
     Com o cru, um prédio sem nome de edifício preenchido cujas vendas vieram escritas de
     dois jeitos pela Prefeitura ("R MIN ALVARO..." e "AV MINISTRO ALVARO...") virava DOIS
     grupos na apresentação que vai pro proprietário — o mesmo endereço listado duas vezes. */
  vendidosOK.forEach(r=>{const rua=ruaExib(r);const k=r.referencia||((rua||'Sem Referência')+'|'+(r.numero||''));if(!grps[k])grps[k]={rows:[],logradouro:r.logradouro,logradouro_fmt:r.logradouro_fmt,numero:r.numero,referencia:r.referencia};grps[k].rows.push(r);});
  const grpTitulo = g => { const rua=ruaExib(g); const base=g.referencia?titleRua(g.referencia):(rua||'Sem Referência'); const num=g.numero?', '+g.numero:''; const match=cfg.edificio&&rua&&ruaKey(rua)===ruaKey(cfg.rua)&&String(g.numero||'')===String(cfg.num||''); return base+num+(match?' · '+esc(cfg.edificio):''); };
  const bldgSvg=`<svg class="bldg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 22V12h6v10M9 7h1M14 7h1M9 12h1M14 12h1"/><\/svg>`;

  /* ── conc cards (up to 6) ── */
  const concCards=concorrentesOK;

  /* ── nossa leitura items ── */
  const lItems=(txt,cls,icon)=>(txt||'').split('\n').filter(s=>s.trim()).map(s=>`<div class="leitura-item"><div class="leitura-icon ${cls}">${icon}<\/div>${esc(s.trim())}<\/div>`).join('');

  /* ── image base ── */
  const IMG='https://accf81.github.io/alex-os-v2/img/acm/';
  const fixImgUrl = url => {
    if (!url) return '';
    const m = url.match(/\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w800';
    return url;
  };

  /* ── condomínio mensal ── */
  const condMensal = im?.condominio_mensal ? R(im.condominio_mensal)+'/mês' : (cfg.condMensal||'—');

  const CSS=`/* ── Reset ─────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
img{display:block;max-width:100%}
table{border-collapse:collapse;width:100%}
a{text-decoration:none;color:inherit}
button{font-family:inherit;cursor:pointer}

/* ── Tokens ────────────────────────────────── */
:root{
  --navy:#1a2744;
  --navy-mid:#2d3f6b;
  --navy-light:#4a6090;
  --navy-pale:#c8d0e8;
  --navy-faint:#eef0f6;
  --orange:#ff6600;
  --orange-dark:#cc5200;
  --orange-pale:#fff3eb;
  --gray:#46494d;
  --gray-500:#7a7d82;
  --gray-300:#c8cacf;
  --gray-100:#f4f4f4;
  --white:#ffffff;
  --black:#111111;
  --success:#16a34a;
  --warn:#d97706;
  --danger:#dc2626;
  --font:'Montserrat',sans-serif;
}

/* ── Base ──────────────────────────────────── */
body{font-family:var(--font);color:var(--black);background:var(--white);line-height:1.5;-webkit-font-smoothing:antialiased}

/* ── Orange italic highlight ───────────────── */
.hl{color:var(--orange);font-style:italic}

/* ── Icons (feather) ───────────────────────── */
[data-feather]{display:inline-block;vertical-align:middle}
.icon-sm [data-feather]{width:16px;height:16px;stroke-width:2}
.icon-md [data-feather]{width:22px;height:22px;stroke-width:2}
.icon-lg [data-feather]{width:32px;height:32px;stroke-width:1.5}
.icon-xl [data-feather]{width:40px;height:40px;stroke-width:1.5}
.icon-color-o [data-feather]{stroke:var(--orange)}
.icon-color-w [data-feather]{stroke:var(--white)}
.icon-color-n [data-feather]{stroke:var(--navy)}
svg.bldg-icon{display:inline-block;vertical-align:middle;flex-shrink:0}

/* ── Sticky nav ────────────────────────────── */
.site-nav{
  position:sticky;top:0;z-index:200;
  background:var(--navy);
  border-bottom:1px solid rgba(255,255,255,.08);
  padding:13px 0;
}
.nav-wrap{
  max-width:1100px;margin:0 auto;padding:0 56px;
  display:flex;align-items:center;justify-content:space-between;
}
.nav-logo-pandora{height:22px;width:auto;order:0}
.nav-logo-pilar{height:18px;width:auto;order:1}

/* ── Layout ────────────────────────────────── */
.wrap{max-width:1100px;margin:0 auto;padding:0 56px}
.sec{padding:96px 0}
.sec-sm{padding:64px 0}
.dark{background:var(--navy);color:var(--white)}
.light{background:var(--white)}
.soft{background:var(--navy-faint)}

/* ── Section badge ─────────────────────────── */
.badge{
  display:inline-block;
  background:var(--orange);color:var(--white);
  font-size:10px;font-weight:800;
  text-transform:uppercase;letter-spacing:.12em;
  padding:4px 12px;border-radius:2px;
  margin-bottom:20px;
}
.badge-ghost{
  display:inline-block;
  background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);
  font-size:10px;font-weight:800;
  text-transform:uppercase;letter-spacing:.12em;
  padding:4px 12px;border-radius:2px;
  margin-bottom:20px;
}

/* ── Typography ────────────────────────────── */
.display{font-size:clamp(44px,5.5vw,76px);font-weight:200;line-height:1.03;letter-spacing:-.025em}
.h1{font-size:clamp(30px,3.5vw,46px);font-weight:200;line-height:1.1;letter-spacing:-.02em}
.h2{font-size:clamp(22px,2.5vw,32px);font-weight:200;line-height:1.2}
.body{font-size:15px;font-weight:400;line-height:1.75;color:var(--gray)}
.body-dark{font-size:15px;font-weight:400;line-height:1.75;color:var(--navy-pale)}
.divider{width:48px;height:2px;background:var(--orange);margin:28px 0}
.divider-ghost{width:48px;height:2px;background:rgba(255,255,255,.25);margin:28px 0}

/* ══════════════════════════════════════════════
   CAPA
══════════════════════════════════════════════ */
.capa{
  min-height:calc(100vh - 48px);
  background:var(--navy);
  position:relative;overflow:hidden;
  display:flex;flex-direction:column;
}
.capa-bleed{
  position:absolute;right:0;top:0;bottom:0;width:44%;
  background:var(--navy-mid);overflow:hidden;
}
.capa-bleed::before{
  content:'';position:absolute;
  left:0;top:0;bottom:0;width:60%;
  background:linear-gradient(to right,var(--navy),transparent);
  z-index:1;
}
.capa-bleed-label{
  font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
  color:rgba(255,255,255,.2);position:relative;z-index:2;
}
.capa-main{
  flex:1;display:flex;align-items:center;
  position:relative;z-index:10;
}
.capa-text-col{
  max-width:54%;padding:72px 0;
}
.capa-tag{
  display:inline-block;
  border:1px solid rgba(255,102,0,.5);color:var(--orange);
  font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  padding:5px 14px;border-radius:2px;margin-bottom:32px;width:fit-content;
}
.capa-title{font-size:clamp(56px,7.5vw,96px);font-weight:200;line-height:.95;letter-spacing:-.03em;color:var(--white);margin-bottom:16px}
.capa-sub{font-size:18px;font-weight:300;color:var(--navy-pale);margin-bottom:10px}
.capa-addr{font-size:14px;font-weight:400;color:rgba(255,255,255,.5);margin-bottom:48px}
.capa-chips{display:flex;gap:10px;flex-wrap:wrap}
.capa-chip{
  background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);
  padding:9px 18px;border-radius:2px;
  font-size:13px;font-weight:500;color:var(--white);
  display:flex;align-items:center;gap:8px;
}
.capa-foot{
  position:relative;z-index:10;
  border-top:1px solid rgba(255,255,255,.1);
}
.capa-foot-inner{
  display:flex;gap:56px;align-items:flex-start;
  padding:28px 0;
}
.capa-meta-label{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:5px}
.capa-meta-val{font-size:14px;font-weight:600;color:var(--white)}

/* ══════════════════════════════════════════════
   IMAGE BLEED SECTIONS (pages 3,4,5,7,10,11)
══════════════════════════════════════════════ */
.sec-img{position:relative;overflow:hidden}
.bleed-r{
  position:absolute;right:0;top:0;bottom:0;width:43%;
  overflow:hidden;
}
.bleed-r img{width:100%;height:100%;object-fit:cover;display:block}
.bleed-fade{
  position:absolute;left:0;top:0;bottom:0;width:55%;
  z-index:1;pointer-events:none;
}
.bleed-fade-dark{background:linear-gradient(to right,var(--navy) 50%,transparent)}
.bleed-fade-light{background:linear-gradient(to right,var(--white) 50%,transparent)}
.bleed-col{
  max-width:55%;
  position:relative;z-index:2;
}

/* ══════════════════════════════════════════════
   ANTES DE COMEÇAR
══════════════════════════════════════════════ */
.perg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
.perg-card{
  border:1px solid var(--gray-300);border-radius:8px;padding:24px;
  transition:border-color .15s,box-shadow .15s;
}
.perg-card:hover{border-color:var(--orange);box-shadow:0 2px 16px rgba(255,102,0,.08)}
.perg-num{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:12px}
.perg-title{font-size:16px;font-weight:700;color:var(--navy);line-height:1.4}

/* ══════════════════════════════════════════════
   CONTEXTO
══════════════════════════════════════════════ */
.ctx-items{display:flex;flex-direction:column;gap:28px;margin-top:32px}
.ctx-item{border-left:2px solid var(--orange);padding-left:22px}
.ctx-item-title{font-size:15px;font-weight:700;color:var(--white);margin-bottom:6px}
.ctx-item-text{font-size:14px;font-weight:400;color:var(--navy-pale);line-height:1.65}

/* ══════════════════════════════════════════════
   O PROBLEMA
══════════════════════════════════════════════ */
.prob-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:36px}
.prob-item{
  display:flex;gap:14px;align-items:flex-start;
  padding:18px 20px;background:var(--gray-100);border-radius:6px;
}
.prob-x{
  width:28px;height:28px;border-radius:50%;flex-shrink:0;margin-top:1px;
  background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);
  display:flex;align-items:center;justify-content:center;
}
.prob-text{font-size:14px;font-weight:500;color:var(--gray);line-height:1.5}

/* ══════════════════════════════════════════════
   A SOLUÇÃO
══════════════════════════════════════════════ */
.solucao-quote{
  font-size:clamp(18px,2.2vw,24px);font-weight:200;font-style:italic;
  color:var(--white);border-left:3px solid var(--orange);padding-left:28px;
  line-height:1.6;margin:36px 0;max-width:680px;
}
.pilar-link{
  display:inline-flex;align-items:center;gap:8px;
  color:var(--white);font-size:14px;font-weight:700;
  border-bottom:1px solid rgba(255,102,0,.4);padding-bottom:2px;
}
.pilar-link span{color:var(--orange)}

/* ══════════════════════════════════════════════
   RESULTADOS
══════════════════════════════════════════════ */
.res-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:48px;margin-top:52px}
.res-kpi-num{font-size:clamp(40px,5vw,64px);font-weight:900;color:var(--orange);line-height:1;margin-bottom:8px}
.res-kpi-label{font-size:13px;font-weight:500;color:var(--gray-500)}
/* Service cards */
.svc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:28px}
.svc-card{padding:24px 20px;background:var(--navy-faint);border-radius:8px}
.svc-icon{
  width:44px;height:44px;border-radius:10px;background:var(--orange);
  display:flex;align-items:center;justify-content:center;margin-bottom:14px;
}
.svc-title{font-size:13px;font-weight:700;color:var(--navy);line-height:1.4}
/* Vendas recentes */
.vendas-divider{border-top:1px solid var(--gray-300);padding-top:44px;margin-top:44px}
.vendas-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.venda-card{background:var(--navy-faint);border-radius:8px;padding:26px 22px;text-align:center}
.venda-valor{font-size:20px;font-weight:900;color:var(--navy);margin-bottom:10px;line-height:1.1}
.venda-badge{
  display:inline-block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  background:var(--navy);color:var(--white);padding:4px 12px;border-radius:2px;
}

/* ══════════════════════════════════════════════
   GESTOR
══════════════════════════════════════════════ */
.gestor-layout{display:grid;grid-template-columns:auto 1fr;gap:64px;align-items:start}
.gestor-photo{
  width:188px;height:240px;border-radius:8px;flex-shrink:0;
  background:var(--navy-mid);
  display:flex;align-items:center;justify-content:center;flex-direction:column;
  border:1px solid rgba(255,255,255,.1);overflow:hidden;
}
.gestor-photo img{width:100%;height:100%;object-fit:cover;border-radius:8px}
.gestor-name{font-size:44px;font-weight:200;color:var(--white);line-height:1;margin-bottom:8px}
.gestor-cargo-creci{
  font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--orange);margin-bottom:28px;
}
.gestor-items{display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
.gestor-item{font-size:14px;font-weight:400;color:var(--navy-pale);display:flex;gap:12px;line-height:1.5;align-items:flex-start}
.gestor-item-dot{color:var(--orange);flex-shrink:0;font-weight:800;margin-top:1px}
.gestor-quote{font-size:15px;font-weight:300;font-style:italic;color:var(--white);border-left:2px solid var(--orange);padding-left:20px;line-height:1.7}

/* ══════════════════════════════════════════════
   MÉTODO PANDORA
══════════════════════════════════════════════ */
.metodo-steps{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin:44px 0;position:relative}
.metodo-step{text-align:center;position:relative}
.metodo-step:not(:last-child)::after{
  content:'';position:absolute;top:24px;left:calc(50% + 28px);right:calc(-50% + 28px);
  height:1px;background:var(--gray-300);
}
.step-circle{
  width:48px;height:48px;border-radius:50%;
  background:var(--orange);color:var(--white);
  font-size:17px;font-weight:800;
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 14px;
}
.step-label{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--navy);line-height:1.4}
.metodo-descs{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-top:36px;border-top:1px solid var(--gray-300)}
.metodo-desc-tag{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--orange);margin-bottom:10px}
.metodo-desc-text{font-size:14px;font-weight:400;color:var(--gray);line-height:1.75}

/* ══════════════════════════════════════════════
   BASTIDORES
══════════════════════════════════════════════ */
.bast-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:44px}
.bast-card{
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.09);
  border-radius:8px;padding:24px 20px;
}
.bast-icon{margin-bottom:16px}
.bast-title{font-size:14px;font-weight:700;color:var(--white);margin-bottom:8px}
.bast-text{font-size:13px;font-weight:400;color:var(--navy-pale);line-height:1.65}

/* ══════════════════════════════════════════════
   DIVISOR ESTRATÉGIA
══════════════════════════════════════════════ */
.estrategia-div{background:var(--orange);padding:52px 0;text-align:center}
.estrat-label{font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:14px}
.estrat-title{font-size:clamp(26px,3.5vw,42px);font-weight:200;color:var(--white)}

/* ══════════════════════════════════════════════
   O IMÓVEL
══════════════════════════════════════════════ */
.imovel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px}
.imovel-kpi{background:rgba(255,255,255,.06);border-radius:8px;padding:24px 22px;border:1px solid rgba(255,255,255,.08)}
.imovel-kpi-label{
  font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--orange);margin-bottom:10px;
}
.imovel-kpi-val{font-size:20px;font-weight:800;color:var(--white);line-height:1.2}

/* ══════════════════════════════════════════════
   CONDOMÍNIOS SIMILARES
══════════════════════════════════════════════ */
.cond-list{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:40px}
.cond-item{
  display:flex;gap:20px;align-items:center;
  padding:20px 24px;background:var(--white);
  border:1px solid var(--gray-300);border-radius:8px;
}
.cond-num{font-size:clamp(28px,3vw,40px);font-weight:900;color:var(--orange);line-height:1;flex-shrink:0;min-width:44px}
.cond-name{font-size:15px;font-weight:700;color:var(--navy)}
.cond-addr{font-size:12px;font-weight:400;color:var(--gray-500);margin-top:3px}

/* ══════════════════════════════════════════════
   BASE DA ANÁLISE
══════════════════════════════════════════════ */
.base-intro{max-width:680px;margin-bottom:52px}
.base-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:56px}
.base-num{font-size:clamp(48px,6vw,72px);font-weight:900;color:var(--orange);line-height:1;margin-bottom:10px}
.base-label{font-size:15px;font-weight:700;color:var(--white);margin-bottom:8px}
.base-desc{font-size:13px;font-weight:400;color:var(--navy-pale);line-height:1.65}

/* ══════════════════════════════════════════════
   CONCORRENTES DESTAQUE
══════════════════════════════════════════════ */
.conc-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:44px}
.conc-card{border:1px solid var(--gray-300);border-radius:8px;overflow:hidden}
.conc-card-img-wrap{
  position:relative;cursor:pointer;overflow:hidden;
  height:196px;background:var(--gray-100);
  display:flex;align-items:center;justify-content:center;
  transition:opacity .15s;
}
.conc-card-img-wrap:hover{opacity:.9}
.conc-card-img-wrap:hover::after{
  content:'Ampliar';
  position:absolute;bottom:10px;right:10px;
  background:rgba(0,0,0,.6);color:var(--white);
  font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  padding:4px 10px;border-radius:2px;
}
.conc-img-placeholder{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gray-500);text-align:center;padding:16px}
.conc-card-body{padding:22px}
.conc-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
.conc-card-name{font-size:16px;font-weight:700;color:var(--navy);margin-bottom:3px}
.conc-card-addr{font-size:12px;font-weight:400;color:var(--gray-500)}
.conc-card-badge{
  font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  background:var(--navy-faint);color:var(--navy-light);
  padding:4px 10px;border-radius:2px;flex-shrink:0;margin-left:8px;
}
.conc-card-vals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.conc-val-label{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gray-500);margin-bottom:4px}
.conc-val-num{font-size:15px;font-weight:800;color:var(--navy)}
.conc-val-num.o{color:var(--orange)}
.conc-card-link{
  display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:var(--orange);border:1px solid rgba(255,102,0,.35);
  padding:7px 14px;border-radius:4px;transition:background .15s;
}
.conc-card-link:hover{background:var(--orange-pale)}

/* ══════════════════════════════════════════════
   TABELAS
══════════════════════════════════════════════ */
.tbl-wrap{overflow-x:auto;margin-top:32px}
.tbl{font-size:13px;font-family:var(--font)}
.tbl th{
  padding:10px 14px;text-align:left;
  font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:var(--gray-500);background:var(--gray-100);
  border-bottom:2px solid var(--gray-300);white-space:nowrap;
}
.tbl th.ctr{text-align:center}
.tbl td{padding:10px 14px;border-bottom:1px solid var(--gray-100);font-size:13px;font-weight:400;color:var(--gray);white-space:nowrap;vertical-align:middle}
.tbl td.ctr{text-align:center}
.tbl tr:last-child td{border-bottom:none}
.tbl tfoot td{font-weight:800;color:var(--navy);background:var(--navy-faint);border-top:2px solid var(--gray-300);font-size:12px}
.tbl .num{text-align:right;font-weight:600}
.tbl .num.o{color:var(--orange);font-weight:700}
.tbl .num.g{color:var(--success);font-weight:700}
.exp-prop{display:block;font-size:10px;font-weight:600;color:var(--warn);margin-top:1px;text-align:right}
.t-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;padding:3px 8px;border-radius:2px}
.t-badge.orange{background:var(--orange-pale);color:var(--orange-dark)}
.t-badge.navy{background:var(--navy-faint);color:var(--navy-light)}
/* ITBI group */
.itbi-group{margin-bottom:48px}
.itbi-group:last-child{margin-bottom:0}
.itbi-group-title{
  font-size:13px;font-weight:800;color:var(--navy);
  padding:12px 14px;
  background:var(--navy-faint);border-radius:6px 6px 0 0;
  border:1px solid var(--gray-300);border-bottom:none;
  display:flex;align-items:center;gap:10px;
}

/* ══════════════════════════════════════════════
   RESULTADO ACM — ÍNDICES UTILIZADOS
══════════════════════════════════════════════ */
.indices-section{margin:40px 0 0}
.indices-heading{
  font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
  color:var(--orange);font-style:italic;margin-bottom:32px;
}
.indices-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.index-col{
  padding:28px 0 0;
  border-top:2px solid rgba(255,255,255,.15);
}
.index-num{
  font-size:clamp(80px,9vw,120px);font-weight:900;color:var(--white);
  line-height:1;letter-spacing:-.04em;margin-bottom:20px;
}
.index-desc{font-size:14px;font-weight:400;color:var(--navy-pale);line-height:1.7}
/* Price bands */
.faixas{display:flex;flex-direction:column;gap:12px;margin:40px 0 0}
.faixa{border-radius:8px;padding:22px 26px;display:flex;align-items:center;justify-content:space-between}
.faixa.g{background:rgba(22,163,74,.07);border:1.5px solid rgba(22,163,74,.25)}
.faixa.y{background:rgba(217,119,6,.07);border:1.5px solid rgba(217,119,6,.25)}
.faixa.r{background:rgba(220,38,38,.07);border:1.5px solid rgba(220,38,38,.25)}
.faixa-tag{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px}
.faixa.g .faixa-tag{color:var(--success)}
.faixa.y .faixa-tag{color:var(--warn)}
.faixa.r .faixa-tag{color:var(--danger)}
.faixa-desc{font-size:13px;color:var(--navy-pale)}
.faixa-val{font-size:30px;font-weight:900;text-align:right;line-height:1}
.faixa.g .faixa-val{color:var(--success)}
.faixa.y .faixa-val{color:var(--warn)}
.faixa.r .faixa-val{color:var(--danger)}
.faixa-m2{font-size:11px;text-align:right;color:var(--navy-pale);margin-top:4px}
.rec-box{
  background:rgba(255,102,0,.14);border:2px solid var(--orange);
  border-radius:8px;padding:26px;margin-top:14px;
  display:flex;align-items:center;justify-content:space-between;
}
.rec-label{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:8px}
.rec-val{font-size:34px;font-weight:900;color:var(--white)}
.rec-badge{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:var(--orange);color:var(--white);padding:10px 22px;border-radius:4px}

/* ══════════════════════════════════════════════
   NOSSA LEITURA
══════════════════════════════════════════════ */
.leitura-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-top:44px}
.leitura-col-title{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding-bottom:14px;margin-bottom:22px;border-bottom:2px solid;display:flex;align-items:center;gap:10px}
.leitura-col-title.verde{color:var(--success);border-color:var(--success)}
.leitura-col-title.amarelo{color:var(--warn);border-color:var(--warn)}
.leitura-col-title.azul{color:var(--navy);border-color:var(--navy)}
.leitura-items{display:flex;flex-direction:column;gap:14px}
.leitura-item{font-size:14px;font-weight:400;color:var(--gray);line-height:1.5;display:flex;gap:12px}
.leitura-icon{font-size:14px;font-weight:800;flex-shrink:0;margin-top:1px;width:16px}
.leitura-icon.verde{color:var(--success)}
.leitura-icon.amarelo{color:var(--warn)}
.leitura-icon.azul{color:var(--navy)}

/* ══════════════════════════════════════════════
   EXCLUSIVIDADE
══════════════════════════════════════════════ */
.excl-probs{display:flex;flex-direction:column;gap:14px;margin-top:36px;max-width:720px}
.excl-row{display:flex;gap:14px;align-items:flex-start}
.exc-x{
  width:28px;height:28px;border-radius:50%;flex-shrink:0;
  background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);
  display:flex;align-items:center;justify-content:center;
}
.excl-row-text{font-size:14px;font-weight:400;color:var(--gray);line-height:1.5;padding-top:4px}
/* Comparison table */
.comp-table-wrap{margin-top:48px;overflow-x:auto}
.comp-table{font-family:var(--font);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}
.comp-table th{
  padding:16px 22px;
  font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
  border-bottom:2px solid rgba(255,255,255,.1);
}
.comp-table th:first-child{background:rgba(220,38,38,.1);color:var(--danger);border-right:1px solid rgba(255,255,255,.1)}
.comp-table th:last-child{background:rgba(255,102,0,.1);color:var(--orange)}
.comp-table td{
  padding:14px 22px;font-size:13px;font-weight:400;line-height:1.5;
  border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top;
}
.comp-table tr:last-child td{border-bottom:none}
.comp-table td:first-child{color:rgba(200,208,232,.75);border-right:1px solid rgba(255,255,255,.08)}
.comp-table td:last-child{color:var(--white)}
.td-row{display:flex;gap:10px;align-items:flex-start}
.excl-quote{max-width:720px;margin:44px auto 0;text-align:center;font-size:clamp(15px,2vw,18px);font-weight:200;font-style:italic;color:var(--white);line-height:1.7}

/* ══════════════════════════════════════════════
   TIMELINE
══════════════════════════════════════════════ */
.timeline-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
.tl-item{background:var(--navy-faint);border-radius:8px;padding:28px 24px}
.tl-icon{
  width:48px;height:48px;border-radius:10px;background:var(--orange);
  display:flex;align-items:center;justify-content:center;margin-bottom:18px;
}
.tl-title{font-size:14px;font-weight:700;color:var(--navy);margin-bottom:8px}
.tl-text{font-size:13px;font-weight:400;color:var(--gray-500);line-height:1.65}

/* ══════════════════════════════════════════════
   FECHAMENTO
══════════════════════════════════════════════ */
.fechamento{
  min-height:65vh;display:flex;flex-direction:column;
  justify-content:center;align-items:center;
  background:linear-gradient(155deg,#0a1628 0%,var(--navy) 100%);
  padding:80px 56px;text-align:center;
}
.fech-logo img{height:28px;width:auto;margin-bottom:8px}
.fech-creci{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--orange);margin-bottom:40px}
.fech-quote{max-width:720px;font-size:clamp(16px,2.2vw,22px);font-weight:200;font-style:italic;color:var(--navy-pale);line-height:1.7;margin-bottom:30px}
.fech-sub{font-size:14px;font-weight:400;color:var(--navy-pale);max-width:560px;margin-bottom:52px;line-height:1.65}
.fech-hero{max-width:780px;font-size:clamp(20px,2.8vw,30px);font-weight:300;color:var(--white);line-height:1.5;margin-bottom:24px}
.fech-hero .hl{font-weight:500}
.fech-cta{max-width:620px;font-size:clamp(15px,1.9vw,18px);font-weight:600;color:var(--orange);line-height:1.55;margin-bottom:52px}
.depo-grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;max-width:900px}
.depo-card{flex:1 1 200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-left:2px solid var(--orange);border-radius:6px;padding:15px 17px}
.depo-text{font-size:13.5px;font-style:italic;color:var(--white);line-height:1.55;margin-bottom:11px}
.depo-author{display:flex;flex-direction:column;gap:1px}
.depo-name{font-size:12px;font-weight:700;color:var(--white)}
.depo-role{font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--orange)}
.imovel-frase{margin-top:26px;max-width:560px;font-size:17px;font-weight:300;font-style:italic;color:var(--white);line-height:1.6;border-left:2px solid var(--orange);padding-left:18px}
.imovel-frase .hl{font-weight:500}
.imovel-cols{display:flex;gap:48px;margin-top:8px;align-items:center;flex-wrap:wrap}
.imovel-main{flex:1 1 540px;min-width:320px}
.imovel-simcol{flex:0 1 300px;min-width:240px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:24px 26px}
.imovel-sim-listcol{display:flex;flex-direction:column;margin-top:6px}
.imovel-sim-row{font-size:14px;color:var(--white);padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.imovel-sim-row:last-child{border-bottom:none}
.imovel-panel{margin-top:26px}
.imovel-stats-row{display:flex;gap:44px;flex-wrap:wrap}
.imovel-stat-lbl{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:4px}
.imovel-stat-val{font-size:24px;font-weight:800;color:var(--white)}
.imovel-sim{margin-top:26px;padding-top:24px;border-top:1px solid rgba(255,255,255,.12)}
.imovel-sim-lbl{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:2px}
.imovel-sim-list{display:flex;flex-wrap:wrap;gap:8px}
.imovel-sim-chip{font-size:12px;color:var(--navy-pale);border:1px solid rgba(255,255,255,.18);padding:5px 12px;border-radius:2px}
.rec-box-center{justify-content:center!important;text-align:center}
.excl-termos{display:flex;gap:16px;margin-top:32px;flex-wrap:wrap}
.excl-termo{flex:1 1 240px;background:rgba(255,107,53,.08);border:1px solid rgba(255,107,53,.28);border-radius:8px;padding:20px 24px}
.excl-termo-num{font-size:30px;font-weight:900;color:var(--orange);line-height:1;margin-bottom:6px}
.excl-termo-lbl{font-size:13px;color:#5a6472;line-height:1.5}
.fech-contatos{display:flex;justify-content:center;gap:60px;flex-wrap:wrap}
.fech-c-label{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:6px}
.fech-c-val{font-size:16px;font-weight:600;color:var(--white)}
.fech-pilar{margin:20px 0 40px}
.fech-pilar img{height:20px;width:auto;opacity:.7;margin:0 auto}

/* ══════════════════════════════════════════════
   LIGHTBOX
══════════════════════════════════════════════ */
.lightbox{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.88);z-index:999;
  align-items:center;justify-content:center;cursor:pointer;
  flex-direction:column;gap:12px;
}
.lightbox.open{display:flex}
.lightbox-inner{
  width:80vw;height:70vh;background:var(--gray-100);
  border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--gray-500);
}
.lightbox-caption{font-size:12px;font-weight:600;color:rgba(255,255,255,.5);letter-spacing:.06em}

/* ══════════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════════ */
@media(max-width:900px){
  .nav-wrap,.wrap{padding:0 24px}
  .site-nav{padding:12px 0}
  .sec{padding:64px 0}
  .capa-text-col{max-width:100%;padding:48px 0}
  .capa-bleed{display:none}
  .capa-foot-inner{gap:24px;flex-wrap:wrap}
  .bleed-r{display:none}
  .bleed-col{max-width:100%}
  .perg-grid,.metodo-steps,.bast-grid,.base-grid,
  .leitura-cols,.vendas-grid,.imovel-grid,.conc-cards,
  .timeline-grid,.res-kpis,.cond-list,.svc-grid{grid-template-columns:1fr}
  .metodo-steps{grid-template-columns:repeat(4,1fr)}
  .prob-grid{grid-template-columns:1fr}
  .gestor-layout{grid-template-columns:1fr}
  .metodo-step::after{display:none}
  .fechamento{padding:60px 24px}
  .estrategia-div{padding:40px 24px}
  .index-num{font-size:60px;min-width:64px}
}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}

/* ═══════════════════════════════════════════════════════════════════
   AJUSTES DE LAYOUT — APRESENTAÇÃO ACM (redesign 13/06, portado 23/06)
═══════════════════════════════════════════════════════════════════ */

/* ── 2. LARGURA: fluida com teto, otimizada pro notebook ──────────── */
.wrap{max-width:1500px;width:92%;padding:0;margin:0 auto}
.nav-wrap{max-width:1500px;width:92%;padding:0;margin:0 auto}

/* ── 1. TIPOGRAFIA: subir a escala de leitura (~+18%) ─────────────── */
.body,.body-dark{font-size:18px;line-height:1.75}
.capa-sub{font-size:21px}
.capa-addr{font-size:16px}
.capa-chip{font-size:15px}
.capa-meta-val{font-size:16px}
.capa-meta-label{font-size:10px}
.badge,.badge-ghost{font-size:11px}
.perg-title{font-size:18px}.perg-num{font-size:10px}
.ctx-item-title{font-size:17px}.ctx-item-text{font-size:16px}
.prob-text{font-size:16px}
.solucao-quote{font-size:clamp(20px,2.4vw,27px)}
.res-kpi-label{font-size:15px}
.svc-title{font-size:15px}
.venda-valor{font-size:23px}.venda-badge{font-size:11px}
.gestor-item{font-size:16px}.gestor-quote{font-size:17px}
.gestor-cargo-creci{font-size:12px}
.metodo-desc-text{font-size:16px}.metodo-desc-tag{font-size:13px}.step-label{font-size:12px}
.bast-title{font-size:16px}.bast-text{font-size:15px}
.imovel-kpi-val{font-size:23px}.imovel-kpi-label{font-size:10px}
.cond-name{font-size:17px}.cond-addr{font-size:14px}
.base-label{font-size:17px}.base-desc{font-size:15px}
.conc-card-name{font-size:18px}.conc-card-addr{font-size:14px}
.conc-val-num{font-size:17px}.conc-val-label{font-size:10px}.conc-card-badge{font-size:10px}.conc-card-link{font-size:12px}
.tbl,.tbl td{font-size:15px}.tbl th{font-size:10px}.tbl tfoot td{font-size:14px}
.itbi-group-title{font-size:15px}
.faixa-desc{font-size:15px}.faixa-tag{font-size:11px}.faixa-val{font-size:34px}.faixa-m2{font-size:12px}
.rec-val{font-size:40px}.rec-label{font-size:10px}.rec-badge{font-size:12px}
.index-desc{font-size:16px}.indices-heading{font-size:12px}
.leitura-item{font-size:16px}.leitura-col-title{font-size:12px}
.excl-row-text{font-size:16px}.excl-quote{font-size:clamp(17px,2.1vw,21px)}
.comp-table td{font-size:15px}.comp-table th{font-size:12px}
.tl-title{font-size:16px}.tl-text{font-size:15px}
.fech-c-val{font-size:18px}.fech-c-label{font-size:10px}.fech-creci{font-size:11px}

/* ── 3. ALTURA: cada página de conteúdo preenche a tela ───────────── */
.sec, .sec-sm{min-height:100vh!important;display:flex!important;flex-direction:column;justify-content:center}
.sec, .sec-sm{padding:0!important}  /* remove o respiro fantasma de 96px (o título flutuante ocupava ele) */
/* a faixa laranja de transição e a capa/fechamento mantêm a altura própria */
.estrategia-div{min-height:0!important;display:block!important}

/* ── 4. LOGOS: inverter posição (arquivos têm nomes trocados) ──────── */
/* logo_pandora.png = arte PILAR · logo_pilar.png = wordmark PANDORA */
.nav-logo-pandora{order:1;height:18px}   /* Pilar  → direita, menor  */
.nav-logo-pilar{order:0;height:26px}     /* Pandora→ esquerda, destaque */

/* ── 6. SEM DEGRADÊ + LINHA LARANJA FINA na borda da imagem ────────── */
.capa-bleed::before{display:none}
.capa-bleed{border-left:2px solid var(--orange)}
.bleed-fade{display:none!important}

/* ═══════════════════════════════════════════════════════════════════
   MOCKUP v2 — slides (snap), fundos navy/cinza, títulos, molduras
═══════════════════════════════════════════════════════════════════ */

/* ── SNAP por proximidade (encaixa o topo; páginas longas rolam) ──── */
html,body{scroll-snap-type:y proximity}
html{scroll-padding-top:55px;scroll-behavior:smooth}
section{scroll-snap-align:start;scroll-snap-stop:always}

/* ── LOGO no header ───────────────────────────────────────────────── */
.nav-pandora svg{height:26px;width:auto;display:block}
.nav-pandora{display:flex;align-items:center}
.nav-pilar-img{height:30px;width:auto;opacity:.95}
.site-nav{padding:14px 0}

/* ── FUNDOS: quase tudo navy · dados em cinza claro ───────────────── */
.sec.light:not(.bg-data), .sec.soft:not(.bg-data){background:var(--navy)!important;color:var(--navy-pale)!important}
/* DADOS em charcoal escuro (distinto do navy pelo tom neutro) + tabelas no tema escuro */
.bg-data{background:#1f2125!important;color:var(--navy-pale)!important;display:block!important}
.bg-data > .wrap{padding:88px 0 50px!important}
.bg-data .body{margin-top:6px!important}
.bg-data .conc-cards{margin-top:22px!important}
.slide-datacenter{display:flex!important;flex-direction:column;justify-content:flex-start!important}
.slide-datacenter > .wrap{padding:104px 0 44px!important}
/* nada de texto azul/navy no charcoal — tudo branco ou navy-pale */
.bg-data :where(.h1,.h2,.conc-card-name,.conc-val-num,.cond-name,.base-label,.venda-valor,.itbi-group-title,.tbl tfoot td,.t-badge.navy,.indices-heading,.index-num){color:#fff!important}
.bg-data :where(.body,.body-dark,.tbl td,.conc-card-addr,.conc-val-label,.cond-addr,.base-desc,.metodo-desc-text,.leitura-item,.index-desc,.ctx-item-text,.prob-text,.svc-title){color:var(--navy-pale)!important}
.bg-data .tbl th{background:rgba(255,255,255,.06)!important;color:rgba(255,255,255,.6)!important;border-bottom-color:rgba(255,255,255,.18)!important}
.bg-data .tbl td{color:var(--navy-pale)!important;border-bottom-color:rgba(255,255,255,.08)!important}
.bg-data .tbl tfoot td{background:rgba(255,255,255,.05)!important;color:#fff!important;border-top-color:rgba(255,255,255,.2)!important}
.bg-data .itbi-group-title{background:rgba(255,255,255,.06)!important;color:#fff!important;border-color:rgba(255,255,255,.12)!important}
.bg-data .conc-card{border-color:rgba(255,255,255,.14)!important;background:rgba(255,255,255,.04)!important}
.bg-data .conc-card-name{color:#fff!important}
.bg-data .conc-card-addr, .bg-data .conc-val-label{color:var(--navy-pale)!important}
.bg-data .conc-val-num{color:#fff!important}
.bg-data .conc-card-badge{background:rgba(255,255,255,.1)!important;color:var(--navy-pale)!important}
.bg-data .conc-card-img-wrap{background:rgba(255,255,255,.06)!important}
.bg-data .t-badge.navy{background:rgba(255,255,255,.1)!important;color:#fff!important}
/* linha sutil só no fim de cada slide (mais sóbrio que linhas espalhadas) */
.sec, .sec-sm, .capa{border-bottom:1px solid rgba(255,255,255,.12)}
.sec.light:not(.bg-data) .h1, .sec.soft:not(.bg-data) .h1{color:#fff!important}
.sec.light:not(.bg-data) .body, .sec.soft:not(.bg-data) .body{color:var(--navy-pale)!important}
.sec.light:not(.bg-data) .perg-title, .sec.light:not(.bg-data) .svc-title,
.sec.light:not(.bg-data) .cond-name, .sec.light:not(.bg-data) .venda-valor,
.sec.light:not(.bg-data) .step-label, .sec.light:not(.bg-data) .tl-title{color:#fff!important}
.sec.light:not(.bg-data) .prob-text, .sec.light:not(.bg-data) .metodo-desc-text,
.sec.light:not(.bg-data) .excl-row-text, .sec.light:not(.bg-data) .tl-text,
.sec.light:not(.bg-data) .cond-addr, .sec.light:not(.bg-data) .res-kpi-label,
.sec.soft:not(.bg-data) .leitura-item{color:var(--navy-pale)!important}
.sec.light:not(.bg-data) .perg-card, .sec.light:not(.bg-data) .svc-card,
.sec.light:not(.bg-data) .tl-item, .sec.light:not(.bg-data) .venda-card,
.sec.light:not(.bg-data) .cond-item, .sec.light:not(.bg-data) .prob-item{
  background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.1)!important}
.sec.light:not(.bg-data) .metodo-descs, .sec.light:not(.bg-data) .vendas-divider{border-top-color:rgba(255,255,255,.15)!important}
.sec.light:not(.bg-data) .metodo-step:not(:last-child)::after{background:rgba(255,255,255,.2)!important}
.sec.soft:not(.bg-data) .leitura-col-title.azul{color:#fff!important;border-color:rgba(255,255,255,.4)!important}

/* ── TÍTULO NOVO: bloco no topo, retângulo aberto em cima ─────────── */
.badge, .badge-ghost, .capa-tag{display:none!important}
section{position:relative}
.slide-head{
  position:absolute;top:0;
  left:max(4%, calc((100% - 1500px)/2));
  border:1px solid;border-top:none;
  padding:16px 26px 13px;
  display:flex;align-items:flex-end;gap:14px;z-index:30;width:440px;
}
.slide-head .sh-num{font-size:46px;font-weight:900;line-height:.82}
.slide-head .sh-txt{display:flex;flex-direction:column;gap:3px}
.slide-head .sh-title{font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;line-height:1.15}
.slide-head .sh-sub{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.slide-head.on-dark{border-color:rgba(255,255,255,.22)}
.slide-head.on-dark .sh-num{color:var(--orange)}
.slide-head.on-dark .sh-title{color:#fff}
.slide-head.on-dark .sh-sub{color:rgba(255,255,255,.55)}
.slide-head.on-light{border-color:var(--gray-300)}
.slide-head.on-light .sh-num{color:var(--orange)}
.slide-head.on-light .sh-title{color:var(--navy)}
.slide-head.on-light .sh-sub{color:var(--gray-500)}
section[class*="sec"] > .wrap{padding:84px 0}

/* ── IMAGENS EMOLDURADAS, recuadas, alinhadas à margem direita ────── */
.sec-img .bleed-r{
  left:auto;
  right:max(4%, calc((100% - 1500px)/2));
  top:96px;bottom:120px;width:29%;
  border:1.5px solid var(--orange);border-radius:0;
}
.sec-img .bleed-col{max-width:54%}
/* CAPA: imagem retangular alta, topo alinhado à linha do título */
.capa-bleed{
  left:auto;right:max(4%, calc((100% - 1500px)/2));
  top:96px;bottom:128px;width:30%;
  border:1.5px solid var(--orange);border-radius:0;
}
.capa-bleed::before{display:none}
.capa-text-col{max-width:52%}
.capa-foot{border-top:none!important}

/* ── GESTOR: corte mais fechado, linha fina reta ──────────────────── */
.gestor-photo{border-width:1.5px!important;border-radius:0!important;width:300px!important;height:380px!important}
.gestor-photo img{object-fit:cover;object-position:center top;transform:scale(1.5);transform-origin:center 20%}

/* ── RESULTADO: faixas em 3 colunas iguais; recomendação em linha abaixo ── */
.faixas{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:16px!important;align-items:stretch}
.faixa{flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:20px;text-align:left}
.faixa-val{text-align:left!important}
.faixa-m2{text-align:left!important}
.faixa-tag{font-size:15px!important;margin-bottom:8px!important}
.rec-label{font-size:17px!important}

/* ── v3: concorrentes 2col imagem grande · pág15 · pág18 ── */
.conc-card-img-wrap{min-height:405px!important;height:405px!important}
.bg-data .conc-card{border-color:rgba(255,140,40,.7)!important}

.slide-resultado{justify-content:center!important}
.slide-resultado > .wrap{padding:80px 0 28px!important}
.slide-resultado .body-dark{margin-top:12px!important}
.slide-resultado .indices-section{margin:34px 0 0!important}
.slide-resultado .indices-heading{margin-bottom:18px!important}
.slide-resultado .faixas{margin-top:32px!important}
.slide-resultado .rec-box{margin-top:30px!important}
.indices-grid{gap:32px!important}
.index-col{display:flex!important;align-items:center;gap:16px;padding:18px 0 0!important}
.index-num{font-size:52px!important;margin-bottom:0!important;flex-shrink:0}
.index-desc{font-size:13.5px!important;line-height:1.4!important}
.faixas{grid-template-columns:repeat(3,1fr)!important;gap:32px!important}
.faixa{gap:14px!important;padding:18px 22px!important}
.rec-box{align-items:center}

.slide-compact{justify-content:center!important}
.slide-compact > .wrap{padding:44px 0!important}
.slide-compact .body-dark{margin-top:8px!important}
.slide-compact .comp-table-wrap{margin-top:12px!important}
.slide-compact .comp-table th{padding:9px 22px!important;text-align:center!important}
.slide-compact .comp-table td{padding:7px 22px!important;font-size:13px!important;text-align:center!important}
.slide-compact .td-row{display:inline-flex!important;width:360px;text-align:left;vertical-align:top}
.slide-compact .excl-quote{margin-top:14px!important;max-width:1020px!important}
/* pág 15 mesmo respiro do topo */
.slide-resultado > .wrap{padding:44px 0!important}
/* pág 19 — compacta e centralizada */
.slide-tl{justify-content:flex-start!important}
.slide-tl > .wrap{padding:104px 0 64px!important}
.slide-tl .timeline-grid{margin-top:40px!important;gap:24px!important}
.slide-tl .tl-item{padding:30px 26px!important}
.slide-tl .body{margin-top:10px!important}
/* fechamento ocupa a tela toda */
.fechamento{min-height:100vh!important}`;

  const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Pandora Homes — ${esc(cfg.edificio||'Análise de Mercado')} · ${primeiroNome}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300&display=swap" rel="stylesheet">
<script src="https://unpkg.com/feather-icons@4.29.0/dist/feather.min.js"><\/script>
<style>${CSS}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.site-nav{display:none}}
<\/style>
</head>
<body>

<!-- NAV -->
<nav class="site-nav">
  <div class="nav-wrap">
    <img src="${IMG}logo_pandora.png" class="nav-logo-pandora" alt="Pandora Homes">
    <img src="${IMG}logo_pilar.png" class="nav-logo-pilar" alt="Rede Pilar">
  </div>
</nav>

<!-- 1. CAPA -->
<section class="capa">
  <div class="slide-head on-dark"><div class="sh-txt"><div class="sh-title">APRESENTAÇÃO DE CAPTAÇÃO<\/div><div class="sh-sub">PANDORA HOMES · REDE PILAR<\/div><\/div><\/div>
  <div class="capa-bleed" style="background-image:url('${IMG}bg_capa.avif');background-size:cover;background-position:center">
    <div class="capa-bleed-label" style="padding:16px;display:none"></div>
  </div>
  <div class="capa-main">
    <div class="wrap">
      <div class="capa-text-col">
        <div class="capa-tag">Apresentação de Captação</div>
        <div class="capa-title">Sra.&nbsp;${esc(primeiroNome)}</div>
        <div class="capa-sub">${esc(cfg.edificio||'—')}</div>
        <div class="capa-addr">${esc(cfg.rua||'')}${cfg.num?' '+cfg.num:''}</div>
        <div class="capa-chips">
          ${area>0?`<span class="capa-chip icon-sm"><i data-feather="maximize-2"><\/i>${area} m²<\/span>`:''}
          ${tipStr!=='—'?`<span class="capa-chip icon-sm"><i data-feather="home"><\/i>${esc(tipStr)}<\/span>`:''}
          ${cfg.andar?`<span class="capa-chip icon-sm"><i data-feather="layers"><\/i>${esc(cfg.andar)} andar<\/span>`:''}
          <span class="capa-chip icon-sm"><i data-feather="calendar"><\/i>${hojeExt}<\/span>
        </div>
      </div>
    </div>
  </div>
  <div class="capa-foot">
    <div class="wrap">
      <div class="capa-foot-inner">
        <div><div class="capa-meta-label">Consultor<\/div><div class="capa-meta-val">Alex Fontes · CRECI 205029-F<\/div><\/div>
        <div><div class="capa-meta-label">Contato<\/div><div class="capa-meta-val">(11) 94524-0721<\/div><\/div>
        <div><div class="capa-meta-label">Imobiliária<\/div><div class="capa-meta-val">Pandora Homes · Rede Pilar<\/div><\/div>
        <div><div class="capa-meta-label">Data<\/div><div class="capa-meta-val">${hojeExt}<\/div><\/div>
      </div>
    </div>
  </div>
</section>

<!-- 2. ANTES DE COMEÇAR -->
<section class="sec light">
  <div class="slide-head on-dark"><div class="sh-num">1.<\/div><div class="sh-txt"><div class="sh-title">ANTES DE COMEÇAR<\/div><div class="sh-sub">QUEREMOS ENTENDER VOCÊ<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Antes de Começar<\/div>
    <div class="h1" style="color:var(--navy);max-width:560px">Queremos entender <span class="hl">você<\/span><\/div>
    <div class="body" style="margin-top:16px;max-width:620px">Antes de qualquer análise, gostaríamos de entender melhor seu <strong>momento de venda<\/strong> e o que espera deste processo.<\/div>
    <div class="perg-grid">
      <div class="perg-card"><div class="perg-num">Histórico<\/div><div class="perg-title">Qual sua história com este imóvel?<\/div><\/div>
      <div class="perg-card"><div class="perg-num">Motivação<\/div><div class="perg-title">O que motivou a decisão de vender agora?<\/div><\/div>
      <div class="perg-card"><div class="perg-num">Prazo<\/div><div class="perg-title">Qual o prazo ideal que você tem em mente?<\/div><\/div>
      <div class="perg-card"><div class="perg-num">Experiência<\/div><div class="perg-title">Já teve alguma experiência anterior de venda?<\/div><\/div>
      <div class="perg-card"><div class="perg-num">Prioridade<\/div><div class="perg-title">Preço, prazo ou praticidade — o que é mais importante?<\/div><\/div>
      <div class="perg-card"><div class="perg-num">Urgência<\/div><div class="perg-title">Não vender em 180 dias é um problema?<\/div><\/div>
    </div>
  </div>
</section>

<!-- 3. CONTEXTO -->
<section class="sec dark sec-img" style="min-height:70vh">
  <div class="slide-head on-dark"><div class="sh-num">2.<\/div><div class="sh-txt"><div class="sh-title">O CONTEXTO<\/div><div class="sh-sub">O MERCADO MUDOU<\/div><\/div><\/div>
  <div class="bleed-r" style="background-image:url('${IMG}bg_contexto.jpg');background-size:cover;background-position:center">
    <div class="bleed-fade bleed-fade-dark"><\/div>
  </div>
  <div class="wrap" style="position:relative;z-index:2;min-height:70vh;display:flex;align-items:center">
    <div class="bleed-col">
      <div class="badge-ghost">Contexto<\/div>
      <div class="h1" style="color:var(--white)">Vender um imóvel de alto padrão ficou <span class="hl">mais complexo<\/span><\/div>
      <div class="divider-ghost"><\/div>
      <div class="body-dark">O mercado mudou. Compradores estão mais informados, mais seletivos e com acesso imediato a <span class="hl">milhares de opções<\/span>. A disputa por atenção qualificada nunca foi tão acirrada.<\/div>
      <div style="margin-top:22px;font-size:18px;font-weight:600;color:var(--white);line-height:1.45">Hoje não vence quem anuncia mais.<br>Vence quem <span class="hl">posiciona melhor<\/span>.<\/div>
      <div class="ctx-items">
        <div class="ctx-item"><div class="ctx-item-title">Comprador mais seletivo<\/div><div class="ctx-item-text">Pesquisa meses e decide pela primeira impressão. Fotos, dados e preço precisam ser impecáveis desde o primeiro dia.<\/div><\/div>
        <div class="ctx-item"><div class="ctx-item-title">Concorrência crescente<\/div><div class="ctx-item-text">Seu imóvel compete com dezenas do mesmo perfil. Posicionamento estratégico não é diferencial — é requisito.<\/div><\/div>
      </div>
    </div>
  </div>
</section>

<!-- 4. O PROBLEMA -->
<section class="sec light sec-img" style="min-height:70vh">
  <div class="slide-head on-dark"><div class="sh-num">3.<\/div><div class="sh-txt"><div class="sh-title">O PROBLEMA<\/div><div class="sh-sub">ERROS QUE ATRASAM A VENDA<\/div><\/div><\/div>
  <div class="bleed-r" style="background-image:url('${IMG}bg_problema.jpg');background-size:cover;background-position:center">
    <div class="bleed-fade bleed-fade-light"><\/div>
  </div>
  <div class="wrap" style="position:relative;z-index:2;min-height:70vh;display:flex;align-items:center">
    <div class="bleed-col">
      <div class="badge">O Problema<\/div>
      <div class="h1" style="color:var(--navy)">Erros que fazem imóveis <span class="hl">demorarem para vender<\/span><\/div>
      <div class="prob-grid">
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Preço desalinhado afasta compradores qualificados<\/div><\/div>
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Múltiplos corretores destroem a percepção de valor<\/div><\/div>
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Fotos ruins — o comprador decide antes de visitar<\/div><\/div>
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Falta de estratégia — sem segmentação, sem resultado<\/div><\/div>
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Visitas sem qualificação desgastam o imóvel<\/div><\/div>
        <div class="prob-item"><div class="prob-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="prob-text">Ninguém assume responsabilidade pelo resultado<\/div><\/div>
      </div>
    </div>
  </div>
</section>

<!-- 5. A SOLUÇÃO -->
<section class="sec dark sec-img" style="min-height:70vh">
  <div class="slide-head on-dark"><div class="sh-num">4.<\/div><div class="sh-txt"><div class="sh-title">POR QUE A PANDORA HOMES<\/div><div class="sh-sub">JUNTO AO CLIENTE<\/div><\/div><\/div>
  <div class="bleed-r" style="background-image:url('${IMG}bg_solucao.jpg');background-size:cover;background-position:center">
    <div class="bleed-fade bleed-fade-dark"><\/div>
  </div>
  <div class="wrap" style="position:relative;z-index:2;min-height:70vh;display:flex;align-items:center">
    <div class="bleed-col">
      <div class="badge-ghost">A Solução<\/div>
      <div class="h1" style="color:var(--white)">Por que a <span class="hl">Pandora Homes<\/span>?<\/div>
      <div class="solucao-quote">"Vender um imóvel é mais do que uma transação: é conectar pessoas ao <span class="hl">lar ideal<\/span>."<\/div>
      <div class="body-dark">Somos especialistas em imóveis de alto padrão nos principais bairros de São Paulo desde 2018. Combinamos <span class="hl">tecnologia, dados reais e atendimento personalizado<\/span> para maximizar o resultado da sua venda.<\/div>
      <div style="margin-top:32px">
        <a href="https://www.pilarhomes.com.br" target="_blank" class="pilar-link">
          <i data-feather="external-link" style="width:14px;height:14px;stroke:var(--orange)"><\/i>
          Parte da <span>Rede Pilar<\/span> — a maior rede de boutique imobiliárias do Brasil
        <\/a>
      </div>
    </div>
  </div>
</section>

<!-- 6. RESULTADOS -->
<section class="sec light">
  <div class="slide-head on-dark"><div class="sh-num">5.<\/div><div class="sh-txt"><div class="sh-title">RESULTADOS<\/div><div class="sh-sub">NÚMEROS QUE FALAM<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Resultados<\/div>
    <div class="h1" style="color:var(--navy)">Números que <span class="hl">falam<\/span><\/div>
    <div class="body" style="margin-top:14px;max-width:660px;font-size:17px;color:var(--navy)">Seu imóvel será exposto para uma rede de <strong>mais de 800 especialistas<\/strong> atuando diariamente no mercado de alto padrão.<\/div>
    <div class="res-kpis">
      <div><div class="res-kpi-num">+220<\/div><div class="res-kpi-label">Imobiliárias na Rede Pilar<\/div><\/div>
      <div><div class="res-kpi-num">+800<\/div><div class="res-kpi-label">Corretores especializados<\/div><\/div>
      <div><div class="res-kpi-num">R$ 3,5bi<\/div><div class="res-kpi-label">VGV transacionado em 2025<\/div><\/div>
    </div>
    <div style="margin-top:44px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--navy-light)">Serviços inclusos<\/div>
    <div class="svc-grid">
      <div class="svc-card"><div class="svc-icon icon-sm icon-color-w"><i data-feather="dollar-sign"><\/i><\/div><div class="svc-title">Assessoria Financeira<\/div><\/div>
      <div class="svc-card"><div class="svc-icon icon-sm icon-color-w"><i data-feather="shield"><\/i><\/div><div class="svc-title">Assessoria Jurídica<\/div><\/div>
      <div class="svc-card"><div class="svc-icon icon-sm icon-color-w"><i data-feather="trending-up"><\/i><\/div><div class="svc-title">Marketing Digital<\/div><\/div>
      <div class="svc-card"><div class="svc-icon icon-sm icon-color-w"><i data-feather="cpu"><\/i><\/div><div class="svc-title">IA + Machine Learning<\/div><\/div>
    </div>
    <div class="vendas-divider">
      <div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--navy-light);margin-bottom:20px">Vendas recentes<\/div>
      <div class="vendas-grid">
        <div class="venda-card"><div class="venda-valor">R$ 2.150.000<\/div><div class="venda-badge">Vendido em 13 dias<\/div><\/div>
        <div class="venda-card"><div class="venda-valor">R$ 5.200.000<\/div><div class="venda-badge">Vendido em 48 dias<\/div><\/div>
        <div class="venda-card"><div class="venda-valor">R$ 4.368.000<\/div><div class="venda-badge">Vendido em 28 dias<\/div><\/div>
        <div class="venda-card"><div class="venda-valor">R$ 2.500.000<\/div><div class="venda-badge">Vendido em 37 dias<\/div><\/div>
      </div>
    </div>
  </div>
</section>

<!-- 7. GESTOR -->
<section class="sec dark sec-img">
  <div class="slide-head on-dark"><div class="sh-num">6.<\/div><div class="sh-txt"><div class="sh-title">GESTOR RESPONSÁVEL<\/div><div class="sh-sub">QUEM CONDUZ A SUA VENDA<\/div><\/div><\/div>
  <div class="bleed-r" style="background-image:url('${IMG}alex-perfil.jpg');background-size:cover;background-position:top center">
    <div class="bleed-fade bleed-fade-dark"><\/div>
  </div>
  <div class="wrap" style="position:relative;z-index:2">
    <div class="badge">Gestor Responsável<\/div>
    <div class="bleed-col">
      <div class="gestor-name">Alex Fontes<\/div>
      <div class="gestor-cargo-creci">Gestor Imobiliário · CRECI 205029-F<\/div>
      <div class="gestor-items">
        <div class="gestor-item"><span class="gestor-item-dot">—<\/span>Especialista em Jardim América e bairros nobres desde 2018<\/div>
        <div class="gestor-item"><span class="gestor-item-dot">—<\/span>Sócio fundador da Pandora Homes · Parceiro Rede Pilar<\/div>
        <div class="gestor-item"><span class="gestor-item-dot">—<\/span>Foco em atendimento consultivo e representação estratégica de proprietários<\/div>
        <div class="gestor-item"><span class="gestor-item-dot">—<\/span>Formação em negócios, especialização em mercado imobiliário de luxo<\/div>
      </div>
      <div class="gestor-quote">"Não sou o corretor que só anuncia e aguarda.<br>Sou o <span class="hl">gestor estratégico<\/span> da venda do seu patrimônio."<\/div>
      <div class="depo-grid">
        <div class="depo-card">
          <div class="depo-text">"O Alex já vendeu três imóveis meus. Trabalhar com ele é ter segurança, tranquilidade e a certeza de que meu objetivo vai ser alcançado."<\/div>
          <div class="depo-author"><span class="depo-name">Roberto H.<\/span><span class="depo-role">Proprietário<\/span><\/div>
        </div>
        <div class="depo-card">
          <div class="depo-text">"Comprar meu apartamento em São Paulo com o Alex foi uma experiência única. A rede de contatos e a assessoria dele, do começo até a escritura, fizeram toda a diferença."<\/div>
          <div class="depo-author"><span class="depo-name">João Vieira<\/span><span class="depo-role">Comprador<\/span><\/div>
        </div>
        <div class="depo-card">
          <div class="depo-text">"Quando meu cliente quer os Jardins, procuro o Alex. Ele conhece a região como ninguém e sempre apresenta as melhores opções — meu cliente sai bem atendido."<\/div>
          <div class="depo-author"><span class="depo-name">Suzana Lee<\/span><span class="depo-role">Corretora parceira<\/span><\/div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- 8. MÉTODO PANDORA -->
<section class="sec light">
  <div class="slide-head on-dark"><div class="sh-num">7.<\/div><div class="sh-txt"><div class="sh-title">MÉTODO PANDORA<\/div><div class="sh-sub">COMO TRABALHAMOS<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Como Trabalhamos<\/div>
    <div class="h1" style="color:var(--navy)">Método <strong class="hl">Pandora<\/strong><\/div>
    <div class="metodo-steps">
      <div class="metodo-step"><div class="step-circle">1<\/div><div class="step-label">Diagnós&shy;tico<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">2<\/div><div class="step-label">Posicio&shy;namento<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">3<\/div><div class="step-label">Produção<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">4<\/div><div class="step-label">Divul&shy;gação<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">5<\/div><div class="step-label">Relacio&shy;namento<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">6<\/div><div class="step-label">Nego&shy;ciação<\/div><\/div>
      <div class="metodo-step"><div class="step-circle">7<\/div><div class="step-label">Fecha&shy;mento<\/div><\/div>
    </div>
    <div class="metodo-descs">
      <div><div class="metodo-desc-tag">1–2 · Estratégia<\/div><div class="metodo-desc-text">Análise comparativa, precificação estratégica, definição do público-alvo e narrativa comercial do imóvel.<\/div><\/div>
      <div><div class="metodo-desc-tag">3–4 · Marketing<\/div><div class="metodo-desc-text">Fotos, vídeo e tour virtual profissionais. Divulgação em portais premium, redes sociais e 750+ corretores da Rede Pilar.<\/div><\/div>
      <div><div class="metodo-desc-tag">5–7 · Fechamento<\/div><div class="metodo-desc-text">Qualificação de compradores, condução de visitas, propostas, negociação e assessoria jurídica até a escritura.<\/div><\/div>
    </div>
  </div>
</section>

<!-- 9. BASTIDORES -->
<section class="sec dark">
  <div class="slide-head on-dark"><div class="sh-num">8.<\/div><div class="sh-txt"><div class="sh-title">BASTIDORES<\/div><div class="sh-sub">O TRABALHO INVISÍVEL<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">O Trabalho Invisível<\/div>
    <div class="h1" style="color:var(--white);max-width:680px">O que acontece nos <span class="hl">bastidores<\/span> da venda<\/div>
    <div class="body-dark" style="margin-top:20px;max-width:620px">O proprietário vê foto, anúncio e visita. O que acontece por trás é o que <span class="hl">define o resultado<\/span>.<\/div>
    <div class="bast-grid">
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="filter"><\/i><\/div><div class="bast-title">Qualificação de leads<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="phone"><\/i><\/div><div class="bast-title">Follow-up constante<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="share-2"><\/i><\/div><div class="bast-title">Rede de corretores parceiros<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="bar-chart-2"><\/i><\/div><div class="bast-title">Relatórios de performance<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="crosshair"><\/i><\/div><div class="bast-title">Estratégia de mídia paga<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="shield"><\/i><\/div><div class="bast-title">Assessoria jurídica<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="trending-up"><\/i><\/div><div class="bast-title">Negociação técnica<\/div><\/div>
      <div class="bast-card"><div class="bast-icon icon-md icon-color-o"><i data-feather="refresh-cw"><\/i><\/div><div class="bast-title">Ajustes de estratégia<\/div><\/div>
    </div>
  </div>
</section>

<!-- DIVISOR PARTE II -->
<div class="estrategia-div">
  <div class="estrat-label">Parte II<\/div>
  <div class="estrat-title">Relatório Estratégico de Posicionamento<\/div>
</div>

<!-- 9. O IMÓVEL (POSICIONAMENTO + Imóvel + Condomínios fundidos) -->
<section class="sec dark">
  <div class="slide-head on-dark"><div class="sh-num">9.<\/div><div class="sh-txt"><div class="sh-title">O IMÓVEL<\/div><div class="sh-sub">${esc((cfg.edificio||'O Imóvel').toUpperCase())}<\/div><\/div><\/div>
  <div class="wrap" style="position:relative;z-index:2">
    <div class="badge">O Imóvel<\/div>
    <div class="imovel-cols">
      <div class="imovel-main">
        <div class="display" style="color:var(--white)">${esc(cfg.edificio||'—')}<\/div>
        <div style="margin-top:10px;font-size:15px;font-weight:500;color:var(--navy-pale)">${esc(cfg.rua||'')}${cfg.num?' '+cfg.num:''}${cfg.apto?' · '+(/^ap/i.test(String(cfg.apto).trim())?esc(String(cfg.apto).trim()):'Apto '+esc(String(cfg.apto).trim())):''}<\/div>
        <div class="imovel-frase">Cada imóvel carrega uma história.<br>Nossa função é transformar essa história na <span class="hl">melhor oportunidade possível de venda<\/span>.<\/div>
        <div class="imovel-panel">
          <div class="imovel-stats-row">
            ${area>0?`<div class="imovel-stat"><div class="imovel-stat-lbl">Área Privativa<\/div><div class="imovel-stat-val">${area} m²<\/div><\/div>`:''}
            ${tipStr!=='—'?`<div class="imovel-stat"><div class="imovel-stat-lbl">Dados do Imóvel<\/div><div class="imovel-stat-val">${esc(tipStr)}<\/div><\/div>`:''}
            ${cfg.andar?`<div class="imovel-stat"><div class="imovel-stat-lbl">Andar<\/div><div class="imovel-stat-val">${esc(cfg.andar)} andar<\/div><\/div>`:''}
            ${condMensal!=='—'?`<div class="imovel-stat"><div class="imovel-stat-lbl">Condomínio<\/div><div class="imovel-stat-val">${esc(condMensal)}<\/div><\/div>`:''}
          <\/div>
        <\/div>
      <\/div>
      ${simList.length?`<div class="imovel-simcol"><div class="imovel-sim-lbl">Condomínios similares<\/div><div class="imovel-sim-listcol">${simList.map(s=>`<div class="imovel-sim-row">${esc(s.nome||'')}<\/div>`).join('')}<\/div><\/div>`:''}
    <\/div>
  <\/div>
<\/section>

<!-- 12. BASE DA ANÁLISE -->
<section class="sec dark">
  <div class="slide-head on-dark"><div class="sh-num">10.<\/div><div class="sh-txt"><div class="sh-title">BASE DA ANÁLISE<\/div><div class="sh-sub">DADOS REAIS, NÃO ESTIMATIVAS<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Base da Análise<\/div>
    <div class="base-intro">
      <div class="h1" style="color:var(--white)">Dados reais, <span class="hl">não estimativas<\/span><\/div>
      <div class="body-dark" style="margin-top:16px">Nossa análise combina <span class="hl">transações reais registradas em cartório (ITBI)<\/span> do edifício e região com levantamento atual de imóveis concorrentes.<\/div>
    </div>
    <div class="base-grid">
      <div><div class="base-num">${vendF.length}<\/div><div class="base-label">Transações ITBI analisadas<\/div><div class="base-desc">Registros reais em cartório — dados precisos sobre o histórico de valores do mercado.<\/div><\/div>
      <div><div class="base-num">${concF.length||concorrentesOK.length}<\/div><div class="base-label">Imóveis concorrentes<\/div><div class="base-desc">Levantamento atual de imóveis de mesmo perfil disponíveis no mercado.<\/div><\/div>
      <div><div class="base-num">6 anos<\/div><div class="base-label">Período de análise<\/div><div class="base-desc">Histórico de transações capturando variações de mercado ao longo do tempo.<\/div><\/div>
    </div>
  </div>
</section>

<!-- 11. HISTÓRICO ITBI (movido para logo após a Base da Análise) -->
${Object.keys(grps).length?`
<section class="sec light bg-data">
  <div class="slide-head on-dark"><div class="sh-num">11.<\/div><div class="sh-txt"><div class="sh-title">HISTÓRICO ITBI<\/div><div class="sh-sub">TRANSAÇÕES REAIS REGISTRADAS<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Análise Comparativa<\/div>
    <div class="h1" style="color:var(--navy)">Histórico de transações ITBI<\/div>
    <div class="body" style="margin-top:10px;margin-bottom:44px">Registros reais de venda em cartório — agrupados por edifício.<\/div>
    ${Object.values(grps).map((g)=>{
      const rows=g.rows;
      const media=rows.length?rows.reduce((s,r)=>s+(parseFloat(r.valorM2)||0),0)/rows.length:0;
      return `<div class="itbi-group">
        <div class="itbi-group-title">${bldgSvg} ${grpTitulo(g)}<\/div>
        <div class="tbl-wrap" style="margin-top:0">
          <table class="tbl">
            <thead><tr><th>#<\/th><th>Data<\/th><th>Unidade<\/th><th>A.U.<\/th><th class="num">Valor<\/th><th class="num">R$/m²<\/th><\/tr><\/thead>
            <tbody>
              ${rows.map((r,i)=>`<tr>
                <td>${i+1}<\/td>
                <td>${fDate(r.data)}<\/td>
                <td>${esc(titleRua(r.complemento||r.apto)||'—')}<\/td>
                <td>${r.area?r.area+' m²':'—'}<\/td>
                <td class="num g">${parseFloat(r.valor)>0?R2(r.valor):'—'}${(p=>(p>0&&p<100)?`<span class="exp-prop">venda de ${p.toLocaleString('pt-BR',{maximumFractionDigits:2})}% do imóvel<\/span>`:'')(parseFloat(r.proporcao))}<\/td>
                <td class="num o">${parseFloat(r.valorM2)>0?R(r.valorM2):'—'}<\/td>
              <\/tr>`).join('')}
            <\/tbody>
            <tfoot><tr><td colspan="4">${rows.length} transações<\/td><td><\/td><td class="num" style="color:var(--orange)">${media>0?'Média: '+R(media):'—'}<\/td><\/tr><\/tfoot>
          <\/table>
        <\/div>
      <\/div>`;
    }).join('')}
  <\/div>
<\/section>
`:''}

<!-- 13. CONCORRENTES DESTAQUE -->
${concCards.length?`
<section class="sec light bg-data">
  <div class="slide-head on-dark"><div class="sh-num">12.<\/div><div class="sh-txt"><div class="sh-title">CONCORRENTES<\/div><div class="sh-sub">ANÁLISE COMPARATIVA<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Análise Comparativa<\/div>
    <div class="h1" style="color:var(--navy)">Concorrentes em destaque<\/div>
    <div class="body" style="margin-top:10px">Imóveis ativos no mercado com perfil comparável ao seu.<\/div>
    <div class="conc-cards">
      ${concCards.map((c,i)=>{
        const au=parseFloat(c.au)||0;
        const vped=parseFloat(c.valorPedido)||0;
        const vm2p=au>0?Math.round(vped/au):0;
        return `<div class="conc-card">
          <div class="conc-card-img-wrap" style="height:180px;overflow:hidden;position:relative"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--gray-100);color:var(--gray-500);font-size:11px;z-index:0">${esc(c.rua||c.edificio||"—")}<\/div>${c.img?'<img src="'+fixImgUrl(c.img)+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1" onerror="this.remove()">':''}<\/div>
          <div class="conc-card-body">
            <div class="conc-card-header">
              <div><div class="conc-card-name">${esc(c.rua||'—')}${c.num?', '+c.num:''}<\/div><div class="conc-card-addr">${esc(c.edificio||'')}<\/div><\/div>
              ${(c.estado||c.conservacao)?`<div class="t-badge orange">${esc(c.estado||c.conservacao)}<\/div>`:''}
            <\/div>
            <div class="conc-card-vals">
              <div><div class="conc-val-label">Valor Pedido<\/div><div class="conc-val-num o">${vped>0?R2(vped):'—'}<\/div><\/div>
              <div><div class="conc-val-label">Área<\/div><div class="conc-val-num">${au>0?au+' m²':'—'}<\/div><\/div>
              <div><div class="conc-val-label">R$/m² Pedido<\/div><div class="conc-val-num">${vm2p>0?R(vm2p):'—'}<\/div><\/div>
            <\/div>
            ${c.link?`<a href="${c.link}" target="_blank" class="conc-card-link icon-sm"><i data-feather="external-link"><\/i> Ver anúncio<\/a>`:''}
          <\/div>
        <\/div>`;
      }).join('')}
    <\/div>
  <\/div>
<\/section>
`:''}

<!-- 14. TABELA CONCORRENTES -->
${concorrentesOK.length?`
<section class="sec-sm soft bg-data slide-datacenter">
  <div class="slide-head on-dark"><div class="sh-num">13.<\/div><div class="sh-txt"><div class="sh-title">TABELA COMPARATIVA<\/div><div class="sh-sub">IMÓVEIS ANUNCIADOS HOJE<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Análise Comparativa<\/div>
    <div class="h2" style="color:var(--navy)">Todos os imóveis concorrentes<\/div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>#<\/th><th>Rua<\/th><th>Nº<\/th><th class="ctr">Estado<\/th>
            <th>D<\/th><th>S<\/th><th>V<\/th><th>A.U.<\/th>
            <th class="num">Valor Pedido<\/th><th class="num">R$/m² Ped.<\/th>
            <th class="num">Est. Venda<\/th><th class="num">R$/m² Est.<\/th>
          <\/tr>
        <\/thead>
        <tbody>
          ${concorrentesOK.map((c,i)=>{
            const au=parseFloat(c.au)||0, vped=parseFloat(c.valorPedido)||0;
            const vm2p=au>0?vped/au:0, vdes=vped*(1-desc), vm2v=au>0?vdes/au:0;
            return `<tr>
              <td>${i+1}<\/td>
              <td>${esc(c.rua||'—')}<\/td>
              <td>${esc(c.num||'—')}<\/td>
              <td class="ctr"><span class="t-badge ${(c.estado||c.conservacao)?'orange':'navy'}">${esc(c.estado||c.conservacao||'—')}<\/span><\/td>
              <td>${c.d||'—'}<\/td><td>${c.s||'—'}<\/td><td>${c.v||'—'}<\/td>
              <td>${au>0?au+' m²':'—'}<\/td>
              <td class="num">${vped>0?R2(vped):'—'}<\/td>
              <td class="num" style="color:var(--orange)">${vm2p>0?R(vm2p):'—'}<\/td>
              <td class="num">${vdes>0?R2(vdes):'—'}<\/td>
              <td class="num" style="color:var(--success)">${vm2v>0?R(vm2v):'—'}<\/td>
            <\/tr>`;
          }).join('')}
        <\/tbody>
        <tfoot>
          <tr>
            <td colspan="8">${concorrentesOK.length} concorrentes · desconto estimado de ${Math.round(desc*100)}%<\/td>
            <td><\/td>
            <td class="num" style="color:var(--orange)">${medPedM2>0?R(medPedM2):'—'}<\/td>
            <td><\/td>
            <td class="num" style="color:var(--success)">${medVenM2>0?R(medVenM2):'—'}<\/td>
          <\/tr>
        <\/tfoot>
      <\/table>
    <\/div>
  <\/div>
<\/section>
`:''}

<!-- 16. RESULTADO -->
<section class="sec dark slide-resultado">
  <div class="slide-head on-dark"><div class="sh-num">14.<\/div><div class="sh-txt"><div class="sh-title">RESULTADO DA ANÁLISE<\/div><div class="sh-sub">VALOR DE MERCADO DO SEU IMÓVEL<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Resultado da Análise<\/div>
    <div class="h1" style="color:var(--white)">Resultado da análise de mercado<\/div>
    <div class="body-dark" style="margin-top:12px;max-width:560px">Metodologia baseada em <strong style="color:var(--white)">três índices de referência<\/strong> que combinam histórico de transações e mercado ativo.<\/div>
    ${f1>0||f2>0||f3>0?`
    <div class="indices-section">
      <div class="indices-heading">Índices Utilizados<\/div>
      <div class="indices-grid">
        <div class="index-col"><div class="index-num">1<\/div><div class="index-desc">Imóveis disponíveis no mercado para mesma <em>'persona compradora'<\/em><\/div><\/div>
        <div class="index-col"><div class="index-num">2<\/div><div class="index-desc">Últimas transações ITBI registradas em cartório<\/div><\/div>
        <div class="index-col"><div class="index-num">3<\/div><div class="index-desc">Média de desconto aplicada sobre valor de pedido (${Math.round(desc*100)}%)<\/div><\/div>
      <\/div>
    <\/div>
    <div class="faixas">
      ${f1>0?`<div class="faixa g"><div><div class="faixa-tag">Venda Rápida<\/div><div class="faixa-desc">Estimativa de venda em menos de 30 dias<\/div><\/div><div><div class="faixa-val">${R(f1)}<\/div><div class="faixa-m2">${R(medVenM2)}/m²<\/div><\/div><\/div>`:''}
      ${f2>0?`<div class="faixa y"><div><div class="faixa-tag">Venda Concorrida<\/div><div class="faixa-desc">Preço médio de mercado · 60 a 120 dias<\/div><\/div><div><div class="faixa-val">${R(f2)}<\/div><div class="faixa-m2">${R(medPedM2)}/m²<\/div><\/div><\/div>`:''}
      ${f3>0?`<div class="faixa r"><div><div class="faixa-tag">Poucas Chances<\/div><div class="faixa-desc">Acima da média · mais de 6 meses<\/div><\/div><div><div class="faixa-val">${R(f3)}<\/div><div class="faixa-m2">${R(medPedM2*1.1)}/m²<\/div><\/div><\/div>`:''}
    <\/div>
    `:''}
    ${vp>0||rec>0?`
    <div class="rec-box rec-box-center">
      <div>
        <div class="rec-label">Recomendação Pandora Homes<\/div>
        <div class="rec-val">${rec>0?R(rec):(vp>0?R(vp):'—')}<\/div>
      <\/div>
    <\/div>
    `:''}
  <\/div>
<\/section>

<!-- 17. NOSSA LEITURA -->
${cfg.pontosFort||cfg.pontosAtencao||cfg.oportunidades?`
<section class="sec soft">
  <div class="slide-head on-dark"><div class="sh-num">15.<\/div><div class="sh-txt"><div class="sh-title">NOSSA LEITURA<\/div><div class="sh-sub">O QUE ENXERGAMOS NO SEU IMÓVEL<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Nossa Leitura<\/div>
    <div class="h1" style="color:var(--navy)">O que <span class="hl">enxergamos<\/span> sobre o seu imóvel<\/div>
    <div class="leitura-cols">
      <div>
        <div class="leitura-col-title verde"><i data-feather="plus-circle" style="width:16px;height:16px;stroke:var(--success)"><\/i>Pontos Fortes<\/div>
        <div class="leitura-items">${lItems(cfg.pontosFort,'verde','+')}<\/div>
      <\/div>
      <div>
        <div class="leitura-col-title amarelo"><i data-feather="alert-circle" style="width:16px;height:16px;stroke:var(--warn)"><\/i>Pontos de Atenção<\/div>
        <div class="leitura-items">${lItems(cfg.pontosAtencao,'amarelo','~')}<\/div>
      <\/div>
      <div>
        <div class="leitura-col-title azul"><i data-feather="arrow-right-circle" style="width:16px;height:16px;stroke:var(--navy)"><\/i>Oportunidades<\/div>
        <div class="leitura-items">${lItems(cfg.oportunidades,'azul','→')}<\/div>
      <\/div>
    <\/div>
  <\/div>
<\/section>
`:''}

<!-- 18. EXCLUSIVIDADE -->
<section class="sec light sec-img">
  <div class="slide-head on-dark"><div class="sh-num">16.<\/div><div class="sh-txt"><div class="sh-title">REPRESENTAÇÃO EXCLUSIVA<\/div><div class="sh-sub">O CUSTO DE VENDER SEM GESTOR<\/div><\/div><\/div>
  <div class="bleed-r" style="background-image:url('${IMG}bg-semgestor.jpg');background-size:cover;background-position:center"><\/div>
  <div class="wrap" style="position:relative;z-index:2">
    <div class="badge">Representação Exclusiva<\/div>
    <div class="bleed-col" style="max-width:54%">
    <div class="h1" style="color:var(--navy);max-width:680px">O que acontece quando você vende <span class="hl">sem um gestor responsável<\/span>?<\/div>
    <div class="excl-probs">
      <div class="excl-row"><div class="exc-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="excl-row-text">Preços diferentes em cada portal destroem o valor percebido<\/div><\/div>
      <div class="excl-row"><div class="exc-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="excl-row-text">Informações divergentes confundem o comprador<\/div><\/div>
      <div class="excl-row"><div class="exc-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="excl-row-text">Fotos ruins de um corretor prejudicam os esforços de todos<\/div><\/div>
      <div class="excl-row"><div class="exc-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="excl-row-text">Nenhum corretor investe de verdade em algo que pode perder a qualquer momento<\/div><\/div>
      <div class="excl-row"><div class="exc-x icon-sm"><i data-feather="x" style="stroke:var(--danger)"><\/i><\/div><div class="excl-row-text">O imóvel parece "queimado" e perde o momento de máximo valor<\/div><\/div>
    </div>
    </div>
  </div>
</section>

<!-- 19. COMPARATIVO EXCLUSIVIDADE -->
<section class="sec dark slide-compact">
  <div class="slide-head on-dark"><div class="sh-num">17.<\/div><div class="sh-txt"><div class="sh-title">POR QUE RECOMENDAMOS<\/div><div class="sh-sub">SEGURANÇA PARA O PROPRIETÁRIO<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Por que Recomendamos<\/div>
    <div class="h1" style="color:var(--white)">Representação exclusiva é <span class="hl">segurança para o proprietário<\/span><br>e proteção ao seu patrimônio<\/div>
    <div class="body-dark" style="margin-top:20px;max-width:960px">Com um único gestor responsável, cada decisão é estratégica e coordenada — do preço às fotos, dos leads à negociação final.<\/div>
    <div class="comp-table-wrap">
      <table class="comp-table">
        <thead>
          <tr><th>Venda Tradicional (Aberta)<\/th><th>Gestão Exclusiva Pandora<\/th><\/tr>
        <\/thead>
        <tbody>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Múltiplos corretores sem coordenação<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Um gestor responsável pelo resultado<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Fotos amadoras ou inconsistentes<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Ensaio fotográfico e vídeo profissional<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Preços inconsistentes entre portais<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Preço estratégico e comunicação unificada<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Anúncio genérico sem diferencial<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Campanha personalizada com narrativa do imóvel<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Visitas sem qualificação<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Apenas compradores qualificados visitam<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Nenhum investimento em marketing real<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Investimento próprio em mídia e produção<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Relatórios inexistentes ou irregulares<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Acompanhamento semanal e transparência total<\/span><\/div><\/td><\/tr>
          <tr><td><div class="td-row"><i data-feather="x" style="width:14px;height:14px;stroke:var(--danger);flex-shrink:0;margin-top:2px"><\/i><span>Responsabilidade diluída — ninguém assume<\/span><\/div><\/td><td><div class="td-row"><i data-feather="check" style="width:14px;height:14px;stroke:var(--orange);flex-shrink:0;margin-top:2px"><\/i><span>Accountability total do início à escritura<\/span><\/div><\/td><\/tr>
        <\/tbody>
      <\/table>
    <\/div>
    <div class="excl-quote">"Representação exclusiva é <span class="hl">dedicação total a você e seu objetivo<\/span>, com comunicação unificada, cuidado único e responsabilidade plena pelo resultado."<\/div>
  <\/div>
<\/section>

<!-- 20. DO INÍCIO À ESCRITURA -->
<section class="sec light slide-tl">
  <div class="slide-head on-dark"><div class="sh-num">18.<\/div><div class="sh-txt"><div class="sh-title">DO INÍCIO À ESCRITURA<\/div><div class="sh-sub">ACOMPANHAMENTO COMPLETO<\/div><\/div><\/div>
  <div class="wrap">
    <div class="badge">Acompanhamento<\/div>
    <div class="h1" style="color:var(--navy);text-align:left">Uma venda conduzida do <span class="hl">começo ao fim<\/span><\/div>
    <div class="body" style="margin-top:12px;max-width:760px;text-align:left">Você não precisa se preocupar com os detalhes. Esse é o nosso trabalho.<\/div>
    <div class="timeline-grid">
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="search" style="stroke:white"><\/i><\/div><div class="tl-title">Diagnóstico inicial<\/div><div class="tl-desc">ACM, posicionamento estratégico e definição de preço<\/div><\/div>
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="camera" style="stroke:white"><\/i><\/div><div class="tl-title">Marketing profissional<\/div><div class="tl-desc">Fotos, vídeo, tour virtual e campanha digital personalizada<\/div><\/div>
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="bar-chart-2" style="stroke:white"><\/i><\/div><div class="tl-title">Relatórios de gestão<\/div><div class="tl-desc">Performance de anúncios, feedback de leads e ajustes de estratégia<\/div><\/div>
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="users" style="stroke:white"><\/i><\/div><div class="tl-title">Parcerias ativas<\/div><div class="tl-desc">750+ corretores da Rede Pilar mobilizados para o seu imóvel<\/div><\/div>
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="file-text" style="stroke:white"><\/i><\/div><div class="tl-title">Documentação completa<\/div><div class="tl-desc">Assessoria jurídica, contrato, ITBI e todas as etapas do fechamento<\/div><\/div>
      <div class="tl-item"><div class="tl-icon icon-md"><i data-feather="key" style="stroke:white"><\/i><\/div><div class="tl-title">Até a escritura<\/div><div class="tl-desc">Presença e suporte em todas as etapas até a entrega das chaves<\/div><\/div>
    <\/div>
    <div class="excl-termos">
      <div class="excl-termo"><div class="excl-termo-num">180 dias<\/div><div class="excl-termo-lbl">de trabalho dedicado e exclusivo ao seu imóvel<\/div><\/div>
      <div class="excl-termo"><div class="excl-termo-num">6%<\/div><div class="excl-termo-lbl">de comissão — assessoria completa até a escritura, sem custos adicionais<\/div><\/div>
    <\/div>
  <\/div>
<\/section>

<!-- 21. FECHAMENTO -->
<section class="fechamento">
  <div class="fech-logo"><img src="${IMG}logo_pandora.png" alt="Pandora Homes"><\/div>
  <div class="fech-pilar"><img src="${IMG}logo_pilar.png" alt="Rede Pilar"><\/div>
  <div class="fech-creci">Alex Fontes · CRECI 205029-F<\/div>
  <div class="fech-quote">"Meu trabalho não é apenas anunciar seu imóvel. É <span class="hl">representar seu patrimônio<\/span> perante o mercado, conduzir toda a estratégia e entregar o resultado que você merece."<\/div>
  <div class="fech-hero">Quando assumo uma representação exclusiva, assumo pessoalmente a <span class="hl">condução estratégica<\/span> desta venda.<\/div>
  <div class="fech-cta">Conte comigo para conduzir cada etapa desta venda — juntos, até a escritura.<\/div>
  <div class="fech-contatos">
    <div><div class="fech-c-label">Corretor<\/div><div class="fech-c-val">Alex Fontes<\/div><\/div>
    <div><div class="fech-c-label">Telefone<\/div><div class="fech-c-val">(11) 94524-0721<\/div><\/div>
    <div><div class="fech-c-label">Site<\/div><div class="fech-c-val">www.pandorahomes.com.br<\/div><\/div>
    <div><div class="fech-c-label">Rede Pilar<\/div><div class="fech-c-val">pilarhomes.com.br<\/div><\/div>
    <div><div class="fech-c-label">Instagram<\/div><div class="fech-c-val">@homespandora<\/div><\/div>
  <\/div>
<\/section>

<script>
if(typeof feather!=='undefined')feather.replace();
<\/script>
</body>
</html>`;

  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ACM_' + (cfg.edificio||'imovel').replace(/[^a-zA-Z0-9]/g,'_') + '_' + hoje.replace(/\//g,'-') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✅ ACM exportada!');
}

