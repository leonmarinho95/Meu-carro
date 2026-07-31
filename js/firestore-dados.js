/* ============================================================
   firestore-dados.js  — Fase 2 da migração
   Substitui a leitura do Apps Script pela leitura do Firestore.
   - Login simples (e-mail/senha) com sessão persistente.
   - Lê as 8 coleções e monta o MESMO objeto DADOS que o backend montava.
   - Porta a função calcular() do Codigo.gs para o cliente.

   Carregue ANTES do app.js, e use os SDKs compat do Firebase no index.html
   (veja o passo a passo). Expõe window.carregarTudoFirestore() e
   window.fbLogin()/fbLogout() para o app.js consumir.
   ============================================================ */

// ---------- configuração do projeto (as chaves públicas que você colou) ----------
var firebaseConfig = {
  apiKey: "AIzaSyAWFFOZ_MV-mOiPJlCYPrr_-r6u70-1rrY",
  authDomain: "garagem-fox.firebaseapp.com",
  projectId: "garagem-fox",
  storageBucket: "garagem-fox.firebasestorage.app",
  messagingSenderId: "461191340907",
  appId: "1:461191340907:web:cdd83522e183cbb9e3a22e"
};

firebase.initializeApp(firebaseConfig);
var _db = firebase.firestore();
var _auth = firebase.auth();
// Sessão persistente: você loga uma vez e continua logado entre aberturas.
_auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
// Cache offline: dados disponíveis sem sinal; escritas ficam na fila e
// sincronizam automaticamente quando a rede volta.
// Tenta a versão multi-aba (várias abas compartilham o cache); se indisponível,
// cai para a versão de aba única.
(function(){
  function ativou(){ console.info('Cache offline ATIVO.'); }
  function falhou(err){
    if(err.code==='failed-precondition'){
      console.warn('Cache offline: outra aba já tem o controle. Feche abas extras do app.');
    }else if(err.code==='unimplemented'){
      console.warn('Cache offline: navegador não suporta.');
    }else{
      console.warn('Cache offline indisponível:', err.code||err);
    }
  }
  if(_db.enableMultiTabIndexedDbPersistence){
    _db.enableMultiTabIndexedDbPersistence().then(ativou).catch(function(err){
      // se multi-aba falhar por precondição, tenta a de aba única
      if(err.code==='failed-precondition' && _db.enablePersistence){
        _db.enablePersistence().then(ativou).catch(falhou);
      }else{ falhou(err); }
    });
  }else if(_db.enablePersistence){
    _db.enablePersistence().then(ativou).catch(falhou);
  }
})();

// ---------- helpers ----------
function _num(v) {
  if (v === undefined || v === null || v === "") return null;
  var n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}
function _parseData(s) {
  if (!s) return null;
  s = String(s);
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);     // yyyy-mm-dd
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);        // dd/mm/yyyy
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function _fmtData(d) {
  var y = d.getFullYear(), m = ("0" + (d.getMonth() + 1)).slice(-2), dia = ("0" + d.getDate()).slice(-2);
  return y + "-" + m + "-" + dia;
}
// Normaliza qualquer data para yyyy-mm-dd. Retorna a original se não reconhecer.
function _normalizarData(s) {
  if (!s) return s;
  var d = _parseData(s);
  return d ? _fmtData(d) : s;
}

// ---------- cálculo das tarefas (portado de Codigo.gs > calcular) ----------
function _calcular(t, kmAtual) {
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var ultKm = _num(t.ult_km), freqKm = _num(t.freq_km), freqDias = _num(t.freq_dias);
  var proxKm = null, restKm = null;
  if (ultKm !== null && freqKm) { proxKm = ultKm + freqKm; restKm = proxKm - kmAtual; }

  var proxData = null, restDias = null;
  var ud = _parseData(t.ult_data);
  if (ud && freqDias) {
    proxData = new Date(ud.getTime());
    proxData.setDate(proxData.getDate() + Math.round(freqDias));
    restDias = Math.round((proxData - hoje) / 86400000);
  }

  var venceu = (restKm !== null && restKm <= 0) || (restDias !== null && restDias <= 0);
  var proximo = false;
  if (!venceu) {
    if (restKm !== null && freqKm && restKm <= Math.max(freqKm * 0.1, 200)) proximo = true;
    if (restDias !== null && restDias <= 15) proximo = true;
  }

  t.prox_km = proxKm !== null ? Math.round(proxKm) : null;
  t.rest_km = restKm !== null ? Math.round(restKm) : null;
  t.prox_data = proxData ? _fmtData(proxData) : null;
  t.rest_dias = restDias;
  t.status = venceu ? "Vencido" : (proximo ? "Próximo" : "OK");
  t.ordem = restDias !== null ? restDias : (restKm !== null ? restKm : 9999999);
  return t;
}

// Converte o documento de referência (linhas como objetos) de volta para
// arrays [tipo, num, desc], que é o formato que o app (refRows) renderiza.
function _refLinhas(snap) {
  if (!snap.exists) return [];
  var linhas = snap.data().linhas || [];
  return linhas.map(function (o) { return [o.tipo, o.num, o.desc]; });
}

// ---------- leitura de uma coleção inteira ----------
async function _lerColecao(nome) {
  var snap;
  try {
    snap = await Promise.race([
      _db.collection(nome).get(),
      new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout')); }, 1500); })
    ]);
  } catch(e) {
    snap = await _db.collection(nome).get({ source: 'cache' });
  }
  var out = [];
  snap.forEach(function (doc) { out.push(doc.data()); });
  return out;
}

// ---------- monta o objeto DADOS idêntico ao que o backend devolvia ----------
async function carregarTudoFirestore() {
  // Lê tudo em paralelo (rápido, sem cold start).
  var res = await Promise.all([
    _getDoc(_db.collection("config").doc("app")),
    _lerColecao("tarefas"),
    _lerColecao("historico"),
    _lerColecao("nao_programadas"),
    _lerColecao("inspecoes"),
    _lerColecao("consumo"),
    _lerColecao("danos"),
    _lerColecao("checklist"),
    _getDoc(_db.collection("referencia").doc("fusiveis_painel")),
    _getDoc(_db.collection("referencia").doc("fusiveis_motor")),
    _lerColecao("compras")
  ]);

  var cfg = res[0].exists ? res[0].data() : {};
  var kmAtual = _num(cfg.km_atual) || 0;

  // tarefas: calcula status no cliente e ordena (igual tarefasCalculadas)
  var tarefas = res[1].map(function (t) { return _calcular(Object.assign({}, t), kmAtual); });
  tarefas.sort(function (a, b) { return a.ordem - b.ordem; });
  var vencidos = tarefas.filter(function (t) { return t.status === "Vencido"; });
  var proximos = tarefas.filter(function (t) { return t.status === "Próximo"; });

  // nao_programadas: calcula prioridade (igual ação "tudo")
  var np = res[3].map(function (n) {
    n.prioridade = (_num(n.velocidade) || 0) * (_num(n.urgencia) || 0) * (_num(n.praticidade) || 0);
    return n;
  });

  // Histórico: normaliza datas para yyyy-mm-dd (em memória, e regrava legado no banco).
  var historico = res[2] || [];
  var precisamNormalizar = [];
  historico.forEach(function (h) {
    var orig = h.data;
    var norm = _normalizarData(orig);
    if (norm !== orig) { h.data = norm; precisamNormalizar.push(h); }
  });
  // Regrava no Firestore apenas os que mudaram, uma única vez (flag no localStorage).
  if (precisamNormalizar.length && !localStorage.getItem('datasNormalizadas')) {
    precisamNormalizar.forEach(function (h) {
      _db.collection("historico").doc(String(h.id)).set({ data: h.data }, { merge: true })
        .catch(function(e){ console.warn('normalização de data adiada:', h.id, e && e.code); });
    });
    localStorage.setItem('datasNormalizadas', '1');
    console.info('Datas do histórico normalizadas:', precisamNormalizar.length, 'registro(s).');
  }

  // Ordena o histórico por data (crescente); com datas normalizadas, fica consistente.
  historico.sort(function (a, b) {
    return String(a.data || '').localeCompare(String(b.data || ''));
  });

  return {
    km_atual: kmAtual,
    veiculo: cfg.veiculo || "Volkswagen Fox 1.0 (2012)",
    tarefas: tarefas,
    vencidos: vencidos, proximos: proximos,
    n_vencidos: vencidos.length, n_proximos: proximos.length, total: tarefas.length,
    historico: historico,
    nao_programadas: np,
    inspecoes: res[4],
    consumo: (res[5]||[]).slice().sort(function(a,b){return (_num(a.id)||0)-(_num(b.id)||0);}),
    danos: res[6],
    checklist: res[7],
    referencia: {
      fusiveis_painel: _refLinhas(res[8]),
      fusiveis_motor: _refLinhas(res[9])
    },
    compras: res[10]
  };
}

// ---------- autenticação (Google) ----------
function fbLogin() {
  var prov = new firebase.auth.GoogleAuthProvider();
  return _auth.signInWithPopup(prov);
}
function fbLogout() {
  return _auth.signOut();
}
function fbOnAuth(cb) {
  _auth.onAuthStateChanged(cb);   // cb(user) — user null = deslogado
}

// ---------- ESCRITAS no Firestore (substituem as ações do Apps Script) ----------

// Próximo id numérico de uma coleção: lê o maior id atual +1.
// (Coleções pequenas; custo desprezível. Sob o lock natural do Firestore por doc.)
async function _proxId(colecao) {
  var snap = await _getColecao(colecao);
  var max = 0;
  snap.forEach(function (d) { var n = _num(d.data().id) || 0; if (n > max) max = n; });
  return max + 1;
}

function _hojeISO() {
  var d = new Date();
  return _fmtData(d);
}

// Leitura segura para offline: tenta o servidor, mas se não responder em 2s
// (ou se offline), busca direto do cache local. Evita travar operações de escrita.
async function _getDoc(ref) {
  try {
    return await Promise.race([
      ref.get(),
      new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, 1500); })
    ]);
  } catch(e) {
    return await ref.get({ source: 'cache' });
  }
}
async function _getColecao(colecao) {
  try {
    return await Promise.race([
      _db.collection(colecao).get(),
      new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, 2000); })
    ]);
  } catch(e) {
    return await _db.collection(colecao).get({ source: 'cache' });
  }
}
async function escreverFirestore(acao, b) {
  b = b || {};
  switch (acao) {

    case "set_km": {
      await _db.collection("config").doc("app").set({ km_atual: _num(b.km_atual) || 0 }, { merge: true });
      return { ok: true };
    }

    case "marcar_feita": {
      var ref = _db.collection("tarefas").doc(String(b.id));
      var snap = await _getDoc(ref);
      if (!snap.exists) return { erro: "nao_encontrada" };
      var t = snap.data();
      var cfgSnap = await _getDoc(_db.collection("config").doc("app"));
      var kmCfg = _num((cfgSnap.exists ? cfgSnap.data() : {}).km_atual) || 0;
      var km = (b.km !== "" && b.km != null) ? _num(b.km) : kmCfg;
      var data = b.data || _hojeISO();
      await ref.set({ ult_km: km, ult_data: data }, { merge: true });
      var hid = await _proxId("historico");
      await _db.collection("historico").doc(String(hid)).set({
        id: hid, data: data, km: km, descricao: "[Manutenção] " + (t.tarefa || ""), origem: "auto"
      });
      if (km > kmCfg) await _db.collection("config").doc("app").set({ km_atual: km }, { merge: true });
      return { ok: true };
    }

    case "add_tarefa": {
      var id = await _proxId("tarefas");
      await _db.collection("tarefas").doc(String(id)).set({
        id: id, componente: b.componente || null, tarefa: b.tarefa || null,
        ult_km: _num(b.ult_km), ult_data: b.ult_data || null,
        freq_km: _num(b.freq_km), freq_dias: _num(b.freq_dias),
        obs: b.obs || null, materiais: b.materiais || null
      });
      return { ok: true };
    }
    case "edit_tarefa": {
      await _db.collection("tarefas").doc(String(b.id)).set({
        componente: b.componente || null, tarefa: b.tarefa || null,
        ult_km: _num(b.ult_km), ult_data: b.ult_data || null,
        freq_km: _num(b.freq_km), freq_dias: _num(b.freq_dias),
        obs: b.obs || null, materiais: b.materiais || null
      }, { merge: true });
      return { ok: true };
    }
    case "del_tarefa": return _del("tarefas", b.id);

    case "add_historico": {
      var hid2 = await _proxId("historico");
      await _db.collection("historico").doc(String(hid2)).set({
        id: hid2, data: b.data || _hojeISO(), km: _num(b.km), descricao: b.descricao || null, origem: "manual"
      });
      return { ok: true };
    }
    case "edit_historico": {
      await _db.collection("historico").doc(String(b.id)).set({
        data: b.data || _hojeISO(), km: _num(b.km), descricao: b.descricao || null
      }, { merge: true });
      return { ok: true };
    }
    case "del_historico": return _del("historico", b.id);

    case "add_nao_prog": {
      var nid = await _proxId("nao_programadas");
      await _db.collection("nao_programadas").doc(String(nid)).set({
        id: nid, tarefa: b.tarefa || null,
        velocidade: _num(b.velocidade), urgencia: _num(b.urgencia), praticidade: _num(b.praticidade),
        obs: b.obs || null, feita: 0
      });
      return { ok: true };
    }
    case "toggle_nao_prog": return _toggle("nao_programadas", b.id, "feita");
    case "del_nao_prog": return _del("nao_programadas", b.id);

    case "add_inspecao": {
      var iid = await _proxId("inspecoes");
      await _db.collection("inspecoes").doc(String(iid)).set({
        id: iid, problema: b.problema || null, solucao: b.solucao || null, resolvido: 0
      });
      return { ok: true };
    }
    case "toggle_inspecao": return _toggle("inspecoes", b.id, "resolvido");
    case "del_inspecao": return _del("inspecoes", b.id);

    case "add_consumo": {
      var km2 = _num(b.km) || 0, kmAnt = _num(b.km_ant) || 0, c = _num(b.consumo) || 0;
      var perc = (km2 && kmAnt) ? km2 - kmAnt : null;
      var media = (perc && c) ? perc / c : null;
      var cid = await _proxId("consumo");
      await _db.collection("consumo").doc(String(cid)).set({
        id: cid, data: b.data || _hojeISO(), km: km2, km_ant: kmAnt,
        percorrido: perc, consumo: c, consumo_medio: media, obs: b.obs || null
      });
      await _atualizarKmSeMaior(km2);   // hodômetro acompanha o abastecimento
      return { ok: true };
    }
    case "edit_consumo": {
      var ekm = _num(b.km) || 0, ekmAnt = _num(b.km_ant) || 0, ec = _num(b.consumo) || 0;
      var eperc = (ekm && ekmAnt) ? ekm - ekmAnt : null;
      var emedia = (eperc && ec) ? eperc / ec : null;
      await _db.collection("consumo").doc(String(b.id)).set({
        data: b.data || _hojeISO(), km: ekm, km_ant: ekmAnt,
        percorrido: eperc, consumo: ec, consumo_medio: emedia, obs: b.obs || null
      }, { merge: true });
      await _atualizarKmSeMaior(ekm);   // hodômetro acompanha a edição
      return { ok: true };
    }
    case "del_consumo": return _del("consumo", b.id);

    case "add_dano": {
      var did = await _proxId("danos");
      await _db.collection("danos").doc(String(did)).set({
        id: did, vista: b.vista || null, x: _num(b.x), y: _num(b.y),
        tipo: b.tipo || null, obs: b.obs || null, data: b.data || _hojeISO()
      });
      return { ok: true };
    }
    case "del_dano": return _del("danos", b.id);

    case "toggle_check": {
      // checklist usa 'chave' como id do documento
      await _db.collection("checklist").doc(String(b.chave)).set({
        chave: b.chave, feito: _num(b.feito) ? 1 : 0, data: b.data || _hojeISO()
      });
      return { ok: true };
    }

    case "add_compra": {
      var cpid = await _proxId("compras");
      await _db.collection("compras").doc(String(cpid)).set({
        id: cpid, nome: b.nome || null, modelo: b.modelo || null,
        qtd: b.qtd || null, obs: b.obs || null
      });
      return { ok: true };
    }
    case "del_compra": return _del("compras", b.id);

    default:
      return { erro: "acao_desconhecida" };
  }
}

async function _del(colecao, id) {
  await _db.collection(colecao).doc(String(id)).delete();
  return { ok: true };
}
// Atualiza o hodômetro (config.km_atual) apenas se o km informado for maior.
// Nunca faz o hodômetro retroceder — protege contra edições de registros antigos.
async function _atualizarKmSeMaior(km) {
  var novo = _num(km);
  if (!novo) return;
  var snap = await _getDoc(_db.collection("config").doc("app"));
  var atual = _num((snap.exists ? snap.data() : {}).km_atual) || 0;
  if (novo > atual) {
    await _db.collection("config").doc("app").set({ km_atual: novo }, { merge: true });
  }
}
async function _toggle(colecao, id, campo) {
  var ref = _db.collection(colecao).doc(String(id));
  var snap = await _getDoc(ref);
  if (!snap.exists) return { erro: "nao_encontrada" };
  var atual = snap.data()[campo];
  var nova = {}; nova[campo] = atual ? 0 : 1;
  await ref.set(nova, { merge: true });
  return { ok: true };
}

window.escreverFirestore = escreverFirestore;
