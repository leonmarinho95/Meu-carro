/* ============================================================
   exportar.js — backup completo (JSON) e PDF de histórico
   Roda 100% no navegador, lendo o objeto global DADOS.
   - exportarBackup(): baixa um .json com todos os dados.
   - exportarPDF(): gera um PDF de histórico de manutenção
     (manutenções + consumo médio + pendências resolvidas).
   Depende de jsPDF (carregado via CDN no index.html).
   ============================================================ */

// Formata data yyyy-mm-dd ou dd/mm/yyyy para dd/mm/yyyy (exibição).
function _expData(s) {
  if (!s) return "—";
  s = String(s);
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return s;
  return s;
}
function _expNum(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("pt-BR");
}

// ---------- 1. BACKUP COMPLETO (JSON) ----------
function exportarBackup() {
  if (!DADOS) { toast("Dados ainda não carregaram."); return; }
  var backup = {
    gerado_em: new Date().toISOString(),
    veiculo: DADOS.veiculo || "",
    km_atual: DADOS.km_atual || 0,
    tarefas: DADOS.tarefas || [],
    historico: DADOS.historico || [],
    nao_programadas: DADOS.nao_programadas || [],
    inspecoes: DADOS.inspecoes || [],
    consumo: DADOS.consumo || [],
    danos: DADOS.danos || [],
    checklist: DADOS.checklist || [],
    referencia: DADOS.referencia || {}
  };
  var txt = JSON.stringify(backup, null, 2);
  var blob = new Blob([txt], { type: "application/json" });
  var data = new Date().toISOString().slice(0, 10);
  _baixarBlob(blob, "garagem-backup-" + data + ".json");
  toast("Backup gerado.");
}

// ---------- 2. PDF DE HISTÓRICO ----------
function exportarPDF() {
  if (!DADOS) { toast("Dados ainda não carregaram."); return; }
  if (typeof window.jspdf === "undefined") { toast("Biblioteca de PDF não carregou. Tente recarregar."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });

  var M = 16;            // margem
  var larg = 210 - M * 2;
  var y = M;

  // cabeçalho
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Histórico de Manutenção", M, y); y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(90);
  doc.text(DADOS.veiculo || "Veículo", M, y); y += 5;
  doc.text("Quilometragem atual: " + _expNum(DADOS.km_atual) + " km", M, y); y += 5;
  doc.text("Documento gerado em " + _expData(new Date().toISOString().slice(0, 10)), M, y); y += 8;
  doc.setTextColor(0);
  doc.setDrawColor(200); doc.line(M, y, M + larg, y); y += 8;

  // helper de quebra de página
  function checarPagina(precisa) {
    if (y + precisa > 297 - M) { doc.addPage(); y = M; }
  }
  function secao(titulo) {
    checarPagina(14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(titulo, M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  }

  // --- Manutenções realizadas (histórico) ---
  secao("Manutenções realizadas");
  var hist = (DADOS.historico || []).slice().sort(function (a, b) {
    return String(b.data).localeCompare(String(a.data));
  });
  if (hist.length === 0) {
    doc.setTextColor(120); doc.text("Sem registros.", M, y); y += 6; doc.setTextColor(0);
  } else {
    hist.forEach(function (r) {
      var linhas = doc.splitTextToSize((r.descricao || "").replace(/\s+/g, " "), larg - 64);
      var alturaBloco = Math.max(linhas.length * 4.6, 5) + 2;
      checarPagina(alturaBloco);
      doc.setFont("helvetica", "bold");
      doc.text(_expData(r.data), M, y);
      doc.text(_expNum(r.km) + " km", M + 30, y);
      doc.setFont("helvetica", "normal");
      doc.text(linhas, M + 60, y);
      y += alturaBloco;
    });
  }
  y += 4;

  // --- Consumo médio ---
  var c = DADOS.consumo || [];
  if (c.length) {
    var validos = c.map(function (x) { return +x.consumo_medio || 0; }).filter(function (n) { return n > 0; });
    var media = validos.length ? (validos.reduce(function (a, b) { return a + b; }, 0) / validos.length) : 0;
    secao("Consumo de combustível");
    checarPagina(10);
    doc.text("Média geral registrada: " + (media ? media.toFixed(2) : "—") + " km/L  (" + c.length + " abastecimentos)", M, y);
    y += 6;
    // últimos 5 registros
    var ult = c.slice().reverse().slice(0, 5);
    ult.forEach(function (x) {
      checarPagina(5);
      doc.setTextColor(90);
      doc.text("• " + _expData(x.data) + " — " + ((+x.consumo_medio) ? (+x.consumo_medio).toFixed(2) : "—") + " km/L", M + 4, y);
      doc.setTextColor(0);
      y += 4.6;
    });
    y += 4;
  }

  // --- Pendências resolvidas ---
  var resolvidas = (DADOS.nao_programadas || []).filter(function (n) { return n.feita; });
  var inspResolv = (DADOS.inspecoes || []).filter(function (i) { return i.resolvido; });
  if (resolvidas.length || inspResolv.length) {
    secao("Pendências resolvidas");
    resolvidas.forEach(function (n) {
      checarPagina(5);
      doc.text("• " + (n.tarefa || ""), M + 4, y); y += 4.6;
    });
    inspResolv.forEach(function (i) {
      checarPagina(5);
      var txt = i.problema || "";
      if (i.solucao) txt += " — " + i.solucao;
      var linhas = doc.splitTextToSize("• " + txt, larg - 4);
      checarPagina(linhas.length * 4.6);
      doc.text(linhas, M + 4, y); y += linhas.length * 4.6;
    });
    y += 4;
  }

  // rodapé em todas as páginas
  var total = doc.internal.getNumberOfPages();
  for (var p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("Garagem · Histórico de manutenção · pág. " + p + "/" + total, M, 297 - 8);
    doc.setTextColor(0);
  }

  var data = new Date().toISOString().slice(0, 10);
  doc.save("historico-manutencao-" + data + ".pdf");
  toast("PDF gerado.");
}

// ---------- util ----------
function _baixarBlob(blob, nome) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

window.exportarBackup = exportarBackup;
window.exportarPDF = exportarPDF;
