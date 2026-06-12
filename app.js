const $=s=>document.querySelector(s);

const RELES={esq:[["R1", "Relé de desligamento do sistema de ar condicionado"], ["R2", "Relé do dispositivo de partida a frio"], ["R3/R4", "Unidade de controle do espelho retrovisor dobrável"], ["R5", "Relé da luz de neblina"], ["R6", "Relé de controle do desembaçador do vidro traseiro"], ["R7", "Relé de lavagem e limpeza intermitente automática"], ["R8", "Relé de alívio de contato X"], ["R9", "Relé do ventilador de ar fresco e do radiador"], ["R10", "Relé do ventilador do radiador de 2ª velocidade"], ["R11", "Relé da bomba de combustível"], ["R12", "Relé da buzina de tom duplo"], ["R13", "Relé de alívio de contato X 2"], ["R14", "Unidade de controle de lavagem e limpeza intermitente automática"], ["R15", "Unidade de controle de lavagem e limpeza intermitente automática"], ["A", "Relé da luz de advertência de perigo"]],dir:[["R16", "Relé do motor de arranque"], ["R17", "Relé do motor de arranque 2"], ["R18", "Relé da bomba hidráulica da caixa de câmbio"]]};
const CHECK={lub:[{"h": "Dobradiças das portas"}, {"k": "lub_1_1", "n": "Esquerdo dianteiro"}, {"k": "lub_1_2", "n": "Direito dianteiro"}, {"k": "lub_1_3", "n": "Esquerdo traseiro"}, {"k": "lub_1_4", "n": "Direito traseiro"}, {"k": "lub_1_5", "n": "Dobradiças do capô"}, {"h": "Canaleta dos vidros"}, {"k": "lub_2_1", "n": "Esquerdo dianteiro"}, {"k": "lub_2_2", "n": "Direito dianteiro"}, {"k": "lub_2_3", "n": "Esquerdo traseiro"}, {"k": "lub_2_4", "n": "Direito traseiro"}, {"h": "Trilhos dos bancos"}, {"k": "lub_3_1", "n": "Motorista"}, {"k": "lub_3_2", "n": "Passageiro"}, {"k": "lub_3_3", "n": "Engrenagens do Limpador de para-brisa"}, {"k": "lub_3_4", "n": "Borracha das portas"}, {"k": "lub_3_5", "n": "Borracha do porta-malas"}, {"h": "Fechaduras das portas"}, {"k": "lub_4_1", "n": "Esquerdo dianteiro"}, {"k": "lub_4_2", "n": "Direito dianteiro"}, {"k": "lub_4_3", "n": "Esquerdo traseiro"}, {"k": "lub_4_4", "n": "Direito traseiro"}, {"k": "lub_4_5", "n": "Câmbio"}, {"h": "Maçaneta interna das portas"}, {"k": "lub_5_1", "n": "Esquerdo dianteiro"}, {"k": "lub_5_2", "n": "Direito dianteiro"}, {"k": "lub_5_3", "n": "Esquerdo traseiro"}, {"k": "lub_5_4", "n": "Direito traseiro"}, {"h": "Maçaneta externa das portas"}, {"k": "lub_6_1", "n": "Esquerdo dianteiro"}, {"k": "lub_6_2", "n": "Direito dianteiro"}, {"k": "lub_6_3", "n": "Esquerdo traseiro"}, {"k": "lub_6_4", "n": "Direito traseiro"}],lim:[{"k": "lim_0_1", "n": "Terminais da bateria"}, {"k": "lim_0_2", "n": "Parafusos e porcas enferrujados"}, {"k": "lim_0_3", "n": "Botões e comandos elétricos"}, {"k": "lim_0_4", "n": "Contato da chave"}]};
let KM=0, compAtivo='Todos', DADOS=null;
let CFG={url:localStorage.getItem('gs_url')||'', senha:localStorage.getItem('gs_senha')||''};

function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),1800)}
function fmt(n){return n==null||n===''?'—':Number(n).toLocaleString('pt-BR')}
function fmtData(d){if(!d)return'—';d=String(d);const m=d.match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:d}
// Converte para número tratando vazio/nulo como null e aceitando vírgula decimal.
function num(v){if(v===''||v===null||v===undefined)return null;const n=Number(String(v).replace(',','.'));return isNaN(n)?null:n;}

// ---------- escrita (agora no Firestore) ----------
// Mantém a assinatura call(acao, extra) para todas as chamadas existentes.
async function call(acao,extra){
  return await escreverFirestore(acao,extra||{});
}
// Recarrega todos os dados do Firestore e atualiza a tela atual.
async function recarregar(){
  DADOS=await carregarTudoFirestore();
  KM=DADOS.km_atual;
  $('#kmVal').textContent=fmt(KM);
  $('#veic').textContent=DADOS.veiculo||'';
  const cur=document.querySelector('nav.tabs button.on').dataset.v;
  ({dash:loadDash,todas:loadTodas,pend:loadPend,hist:loadHist,ref:loadRef,corpo:loadCorpo})[cur]();
}

// ---------- navegação ----------
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  $('#v-'+b.dataset.v).classList.add('on');
  window.scrollTo(0,0);
  ({dash:loadDash,todas:loadTodas,pend:loadPend,hist:loadHist,ref:loadRef,corpo:loadCorpo})[b.dataset.v]();
});

// ---------- card de tarefa ----------
function taskCard(t,full){
  const st=t.status.toLowerCase().replace('ó','o');
  const km=t.rest_km!=null?`<span class="${t.rest_km<0?'neg':''}">faltam <b>${fmt(t.rest_km)}</b> km</span>`:'';
  const dia=t.rest_dias!=null?`<span class="${t.rest_dias<0?'neg':''}">faltam <b>${fmt(t.rest_dias)}</b> dias</span>`:'';
  return `<div class="card ${st}" data-id="${t.id}">
    <div class="top">
      <div><div class="comp">${t.componente||''}</div><div class="tk">${t.tarefa||''}</div></div>
      <span class="badge ${st}">${t.status}</span>
    </div>
    <div class="meta">${km}${dia}
      ${t.prox_km!=null?`<span>próxima: <b>${fmt(t.prox_km)}</b> km</span>`:''}
      ${t.prox_data?`<span>até <b>${fmtData(t.prox_data)}</b></span>`:''}
    </div>
    <div class="extra" id="ex${t.id}">
      ${t.obs?`<div>📋 ${t.obs}</div>`:''}
      ${t.materiais?`<div class="mat">🔧 ${t.materiais}</div>`:''}
      <div style="color:var(--faint);margin-top:5px">Frequência: ${t.freq_km?fmt(t.freq_km)+' km':''} ${t.freq_dias?'/ '+fmt(t.freq_dias)+' dias':''} · Última: ${fmt(t.ult_km)} km em ${fmtData(t.ult_data)}</div>
    </div>
    <div class="acts">
      <button class="done" onclick="marcarFeita(${t.id})">✓ Fiz agora</button>
      ${full?`<button onclick="abrirTarefa(${t.id})">Editar</button>`:''}
      <button class="more" onclick="toggleExtra(${t.id})">${(t.obs||t.materiais)?'detalhes ▾':'info ▾'}</button>
    </div>
  </div>`;
}
function toggleExtra(id){$('#ex'+id).classList.toggle('show')}

// ---------- DASHBOARD ----------
function loadDash(){
  const d=DADOS; if(!d)return;
  $('#sVenc').textContent=d.n_vencidos; $('#sProx').textContent=d.n_proximos;
  $('#sTot').textContent=d.total-d.n_vencidos-d.n_proximos;
  $('#pVenc').textContent=d.n_vencidos; $('#pProx').textContent=d.n_proximos;
  $('#listVenc').innerHTML=d.vencidos.length?d.vencidos.map(t=>taskCard(t)).join(''):'<div class="empty">Nada vencido. 👌</div>';
  $('#listProx').innerHTML=d.proximos.length?d.proximos.map(t=>taskCard(t)).join(''):'<div class="empty">Nada chegando nos próximos dias.</div>';
}

// ---------- TODAS ----------
function loadTodas(){
  const _todas=DADOS.tarefas;
  const comps=['Todos',...new Set(_todas.map(t=>t.componente).filter(Boolean))];
  $('#compFilter').innerHTML=comps.map(c=>`<button class="${c===compAtivo?'on':''}" onclick="setComp('${c}')">${c}</button>`).join('');
  const list=compAtivo==='Todos'?_todas:_todas.filter(t=>t.componente===compAtivo);
  $('#listTodas').innerHTML=list.map(t=>taskCard(t,true)).join('')||'<div class="empty">Nenhuma tarefa.</div>';
}
function setComp(c){compAtivo=c;loadTodas()}

// ---------- marcar feita ----------
function marcarFeita(id){
  const t=DADOS.tarefas.find(x=>String(x.id)===String(id))||{};
  modalForm('Registrar manutenção',`
    <p style="color:var(--muted);font-size:14px;margin-bottom:14px">${t.tarefa||''}</p>
    <div class="frow">
      <div class="fg"><label>KM na realização</label><input id="f_km" type="number" value="${Math.round(KM)}"></div>
      <div class="fg"><label>Data</label><input id="f_data" type="date" value="${hoje()}"></div>
    </div>`,
    async()=>{await call('marcar_feita',{id,km:$('#f_km').value,data:$('#f_data').value});
      fecharModal();toast('Manutenção registrada ✓');await recarregar();}
  );
}

// ---------- editar/criar tarefa ----------
function abrirTarefa(id){
  const t=id?DADOS.tarefas.find(x=>String(x.id)===String(id)):{};
  modalForm(id?'Editar tarefa':'Nova tarefa',`
    <div class="frow">
      <div class="fg"><label>Componente</label><input id="f_comp" value="${t.componente||''}"></div>
      <div class="fg"><label>Tarefa</label><input id="f_tarefa" value="${(t.tarefa||'').replace(/"/g,'&quot;')}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Frequência (km)</label><input id="f_fkm" type="number" value="${t.freq_km||''}"></div>
      <div class="fg"><label>Frequência (dias)</label><input id="f_fdias" type="number" value="${t.freq_dias||''}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Última feita (km)</label><input id="f_ukm" type="number" value="${t.ult_km||''}"></div>
      <div class="fg"><label>Última feita (data)</label><input id="f_udata" type="date" value="${(t.ult_data||'').slice(0,10)}"></div>
    </div>
    <div class="fg"><label>Observação</label><input id="f_obs" value="${(t.obs||'').replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label>Materiais</label><input id="f_mat" value="${(t.materiais||'').replace(/"/g,'&quot;')}"></div>`,
    async()=>{
      const body={id,componente:$('#f_comp').value,tarefa:$('#f_tarefa').value,freq_km:$('#f_fkm').value,
        freq_dias:$('#f_fdias').value,ult_km:$('#f_ukm').value,ult_data:$('#f_udata').value,
        obs:$('#f_obs').value,materiais:$('#f_mat').value};
      await call(id?'edit_tarefa':'add_tarefa',body);
      fecharModal();toast('Salvo ✓');await recarregar();
    }, id?async()=>{if(confirm('Excluir esta tarefa?')){await call('del_tarefa',{id});fecharModal();await recarregar();}}:null);
}

// ---------- PENDÊNCIAS ----------
function loadPend(){
  const np=DADOS.nao_programadas;
  $('#listNaoProg').innerHTML=np.map(n=>`<div class="row ${n.feita?'done':''}">
    <div class="chk ${n.feita?'on':''}" onclick="toggleNP(${n.id})">✓</div>
    <div class="body"><div class="t">${n.tarefa}</div>${n.obs?`<div class="s">${n.obs}</div>`:''}</div>
    <span class="prio" style="background:rgba(242,165,22,.13);color:var(--amber)">${n.prioridade}</span>
    <button class="x" onclick="delNP(${n.id})">×</button></div>`).join('')||'<div class="empty">Nenhuma pendência.</div>';
  const ins=DADOS.inspecoes;
  $('#listInspec').innerHTML=ins.map(i=>`<div class="row ${i.resolvido?'done':''}">
    <div class="chk ${i.resolvido?'on':''}" onclick="toggleIns(${i.id})">✓</div>
    <div class="body"><div class="t">${i.problema}</div>${i.solucao?`<div class="s">→ ${i.solucao}</div>`:''}</div>
    <button class="x" onclick="delIns(${i.id})">×</button></div>`).join('')||'<div class="empty">Nenhum ponto registrado.</div>';
  loadChecklist();
}

// ---------- CHECKLIST (lubrificação / limpeza) ----------
function estadoCheck(){
  const m={};(DADOS.checklist||[]).forEach(c=>{m[c.chave]={feito:num(c.feito)?1:0,data:c.data};});
  return m;
}
function renderCheck(grupo,estado){
  return CHECK[grupo].map(x=>{
    if(x.h)return `<div class="chk-h">${x.h}</div>`;
    const st=estado[x.k]||{feito:0};
    return `<div class="chk-item ${st.feito?'done':''}" onclick="toggleCheck('${x.k}',${st.feito?0:1})">
      <div class="chk ${st.feito?'on':''}">✓</div>
      <div class="t">${x.n}</div>
      ${st.feito&&st.data?`<span class="when">${fmtData(st.data)}</span>`:''}
    </div>`;
  }).join('');
}
function contaCheck(grupo,estado){
  const itens=CHECK[grupo].filter(x=>x.k);
  const feitos=itens.filter(x=>(estado[x.k]||{}).feito).length;
  return feitos+'/'+itens.length;
}
function loadChecklist(){
  const e=estadoCheck();
  $('#listLub').innerHTML=renderCheck('lub',e);
  $('#listLim').innerHTML=renderCheck('lim',e);
  $('#pLub').textContent=contaCheck('lub',e);
  $('#pLim').textContent=contaCheck('lim',e);
}
// Atualiza o estado local (DADOS.checklist) sem recarregar tudo.
function setCheckLocal(chave,feito){
  if(!DADOS.checklist)DADOS.checklist=[];
  const data=feito?hoje():'';
  const linha=DADOS.checklist.find(c=>String(c.chave)===String(chave));
  if(linha){linha.feito=feito;linha.data=data;}
  else DADOS.checklist.push({chave,feito,data});
}
// Marca/desmarca na hora (otimista) e salva em segundo plano.
function toggleCheck(chave,feito){
  setCheckLocal(chave,feito);
  loadChecklist();                       // redesenha imediatamente
  call('toggle_check',{chave,feito,data:hoje()})
    .catch(()=>{                          // se falhar, reverte
      setCheckLocal(chave,feito?0:1);
      loadChecklist();
      toast('Falha ao salvar — tente de novo');
    });
}
function resetCheck(grupo){
  const e=estadoCheck();
  const marcados=CHECK[grupo].filter(x=>x.k&&(e[x.k]||{}).feito);
  if(!marcados.length){toast('Nada para limpar');return;}
  if(!confirm(`Desmarcar todos os ${marcados.length} itens de ${grupo==='lub'?'lubrificação':'limpeza'}?`))return;
  marcados.forEach(x=>setCheckLocal(x.k,0));
  loadChecklist();
  Promise.all(marcados.map(x=>call('toggle_check',{chave:x.k,feito:0})))
    .then(()=>toast('Lista limpa ✓'))
    .catch(()=>{recarregar();toast('Falha ao limpar — recarregando');});
}
// Marca/desmarca pendência na hora (otimista) e salva em segundo plano.
function toggleNP(id){
  const n=DADOS.nao_programadas.find(x=>String(x.id)===String(id));
  if(!n)return;
  n.feita=n.feita?0:1;                     // inverte o estado local
  loadPend();                              // redesenha imediatamente
  call('toggle_nao_prog',{id})
    .catch(()=>{                           // se falhar, reverte
      n.feita=n.feita?0:1;
      loadPend();
      toast('Falha ao salvar — tente de novo');
    });
}
const delNP=async id=>{if(confirm('Excluir?')){await call('del_nao_prog',{id});await recarregar()}};
// Marca/desmarca inspeção na hora (otimista) e salva em segundo plano.
function toggleIns(id){
  const i=DADOS.inspecoes.find(x=>String(x.id)===String(id));
  if(!i)return;
  i.resolvido=i.resolvido?0:1;             // inverte o estado local
  loadPend();                              // redesenha imediatamente
  call('toggle_inspecao',{id})
    .catch(()=>{                           // se falhar, reverte
      i.resolvido=i.resolvido?0:1;
      loadPend();
      toast('Falha ao salvar — tente de novo');
    });
}
const delIns=async id=>{if(confirm('Excluir?')){await call('del_inspecao',{id});await recarregar()}};
function abrirNaoProg(){
  modalForm('Nova melhoria/conserto',`
    <div class="fg"><label>Descrição</label><input id="f_t"></div>
    <div class="frow">
      <div class="fg"><label>Velocidade (1-5)</label><input id="f_v" type="number" min="1" max="5" value="3"></div>
      <div class="fg"><label>Urgência (1-5)</label><input id="f_u" type="number" min="1" max="5" value="3"></div>
    </div>
    <div class="fg"><label>Praticidade (1-5)</label><input id="f_p" type="number" min="1" max="5" value="3"></div>
    <div class="fg"><label>Observação</label><input id="f_o"></div>`,
    async()=>{await call('add_nao_prog',{tarefa:$('#f_t').value,velocidade:$('#f_v').value,
      urgencia:$('#f_u').value,praticidade:$('#f_p').value,obs:$('#f_o').value});fecharModal();await recarregar()});
}
function abrirInspecao(){
  modalForm('Novo ponto de inspeção',`
    <div class="fg"><label>Problema</label><input id="f_pr"></div>
    <div class="fg"><label>Solução</label><input id="f_so"></div>`,
    async()=>{await call('add_inspecao',{problema:$('#f_pr').value,solucao:$('#f_so').value});fecharModal();await recarregar()});
}

// ---------- HISTÓRICO + CONSUMO ----------
function loadHist(){
  const h=DADOS.historico.slice().reverse();
  const barra=`<div class="export-bar">
    <button class="export-btn" onclick="exportarPDF()">📄 PDF de histórico</button>
    <button class="export-btn" onclick="exportarBackup()">💾 Backup completo</button>
  </div>`;
  $('#listHist').innerHTML=barra+(h.map(r=>`<div class="row">
    <div class="body"><div class="t">${r.descricao||''}</div>
    <div class="meta">${fmtData(r.data)} · ${r.km?fmt(r.km)+' km':'—'}</div></div>
    <button class="x" onclick="delHist(${r.id})">×</button></div>`).join('')||'<div class="empty">Sem registros.</div>');
  const c=DADOS.consumo;
  const max=Math.max(...c.map(x=>+x.consumo_medio||0),1);
  $('#listConsumo').innerHTML=c.slice().reverse().map(x=>`<div class="row">
    <div class="body"><div class="t">${x.consumo_medio?(+x.consumo_medio).toFixed(2):'—'} km/L
      <span style="color:var(--faint);font-weight:400;font-size:13px">· ${fmtData(x.data)}</span></div>
    <div class="meta">${fmt(x.percorrido)} km · ${x.consumo?(+x.consumo).toFixed(1)+' L':''} ${x.obs?'· '+x.obs:''}</div>
    <div class="bar"><i style="width:${(+x.consumo_medio||0)/max*100}%"></i></div></div></div>`).join('')||'<div class="empty">Sem registros de consumo.</div>';
}
const delHist=async id=>{if(confirm('Excluir registro?')){await call('del_historico',{id});await recarregar()}};
function abrirHist(){
  modalForm('Novo registro no histórico',`
    <div class="fg"><label>Descrição</label><textarea id="f_d" rows="2"></textarea></div>
    <div class="frow">
      <div class="fg"><label>Data</label><input id="f_dt" type="date" value="${hoje()}"></div>
      <div class="fg"><label>KM</label><input id="f_k" type="number" value="${Math.round(KM)}"></div>
    </div>`,
    async()=>{await call('add_historico',{descricao:$('#f_d').value,data:$('#f_dt').value,km:$('#f_k').value});fecharModal();await recarregar()});
}
function abrirConsumo(){
  const c=DADOS.consumo||[];
  const ultKm=c.length?(c[c.length-1].km||''):'';
  modalForm('Novo abastecimento',`
    <div class="frow">
      <div class="fg"><label>KM anterior</label><input id="f_ka" type="number" value="${ultKm}"></div>
      <div class="fg"><label>KM agora</label><input id="f_kn" type="number" value="${Math.round(KM)}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Litros abastecidos</label><input id="f_l" type="number" step="0.01"></div>
      <div class="fg"><label>Data</label><input id="f_dt" type="date" value="${hoje()}"></div>
    </div>
    <div class="fg"><label>Observação</label><input id="f_o"></div>`,
    async()=>{await call('add_consumo',{km_ant:$('#f_ka').value,km:$('#f_kn').value,consumo:$('#f_l').value,
      data:$('#f_dt').value,obs:$('#f_o').value});fecharModal();await recarregar()});
}

// ---------- REFERÊNCIA (ELÉTRICA) ----------
function loadRef(){
  const r=DADOS.referencia||{};
  $('#imgFusPainel').src='img/fus_painel.jpg';
  $('#imgFusMotor').src='img/fus_motor.jpg';
  $('#imgReleEsq').src='img/rele_esq.jpg';
  $('#imgReleDir').src='img/rele_dir.jpg';
  $('#refPainel').innerHTML=refRows(r.fusiveis_painel);
  $('#refMotor').innerHTML=refRows(r.fusiveis_motor);
  $('#tabReleEsq').innerHTML=releRows(RELES.esq);
  $('#tabReleDir').innerHTML=releRows(RELES.dir);
}
function releRows(rows){
  if(!rows||!rows.length)return'<tr><td>Sem dados.</td></tr>';
  return '<tr><th>#</th><th>Descrição</th></tr>'+
    rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
}
function refRows(rows){
  if(!rows||!rows.length)return'<tr><td>Sem dados.</td></tr>';
  return rows.map(r=>`<tr>${r.map(c=>`<td>${c||''}</td>`).join('')}</tr>`).join('');
}

// ---------- CARROCERIA (marcador de danos) ----------
const TIPO_COR={amassado:'var(--amber)',riscado:'var(--blue)',danificado:'var(--red)',outro:'var(--muted)'};
const TIPO_LBL={amassado:'A',riscado:'R',danificado:'D',outro:'O'};
function loadCorpo(){
  const danos=DADOS.danos||[];
  $('#nDanos').textContent=danos.length;
  document.querySelectorAll('.corpo-wrap').forEach(wrap=>{
    const vista=wrap.dataset.vista;
    wrap.querySelector('img').src = vista==='dir' ? 'img/carroceria_dir.png' : 'img/carroceria.jpg';
    const meus=danos.filter(d=>(d.vista||'esq')===vista);
    wrap.querySelector('.marcadores').innerHTML=meus.map(d=>
      `<div class="mark" style="left:${d.x}%;top:${d.y}%;background:${TIPO_COR[d.tipo]||'var(--muted)'}"
        onclick="verDano(${d.id})" title="${d.tipo}">${TIPO_LBL[d.tipo]||'?'}</div>`).join('');
  });
  $('#listaDanos').innerHTML=danos.length?danos.map(d=>
    `<div class="dano-row">
      <span class="tag" style="background:${TIPO_COR[d.tipo]||'var(--muted)'}"></span>
      <div class="body"><div class="t">${cap(d.tipo)}${d.obs?' — '+d.obs:''}</div>
      <div class="s">${d.vista==='dir'?'Lado direito':'Lado esquerdo'} · registrado em ${fmtData(d.data)}</div></div>
      <button class="x" onclick="delDano(${d.id})">×</button>
    </div>`).join(''):'<div class="empty">Nenhum dano registrado. Toque no carro para adicionar.</div>';
}
function cap(s){return s?s[0].toUpperCase()+s.slice(1):''}

// clique em qualquer das duas vistas -> registrar
document.querySelectorAll('.corpo-wrap').forEach(wrap=>{
  wrap.querySelector('img').addEventListener('click',function(ev){
    const r=wrap.getBoundingClientRect();
    const x=((ev.clientX-r.left)/r.width*100).toFixed(2);
    const y=((ev.clientY-r.top)/r.height*100).toFixed(2);
    novoDano(x,y,wrap.dataset.vista);
  });
});
function novoDano(x,y,vista){
  modalForm('Registrar dano',`
    <div class="fg"><label>Tipo</label>
      <select id="d_tipo">
        <option value="amassado">Amassado</option>
        <option value="riscado">Riscado</option>
        <option value="danificado">Danificado</option>
        <option value="outro">Outro</option>
      </select></div>
    <div class="fg"><label>Observação (opcional)</label><input id="d_obs" placeholder="ex.: porta dianteira direita"></div>`,
    async()=>{await call('add_dano',{vista,x,y,tipo:$('#d_tipo').value,obs:$('#d_obs').value,data:hoje()});
      fecharModal();toast('Dano registrado ✓');await recarregar();}
  );
}
function verDano(id){
  const d=(DADOS.danos||[]).find(x=>String(x.id)===String(id));if(!d)return;
  modalForm(cap(d.tipo),`
    <p style="color:var(--muted);font-size:14px;margin-bottom:6px">${d.obs||'Sem observação.'}</p>
    <p style="color:var(--faint);font-size:13px">Registrado em ${fmtData(d.data)}</p>`,
    async()=>{fecharModal();}, async()=>{await call('del_dano',{id});fecharModal();toast('Dano removido');await recarregar();});
}
const delDano=async id=>{if(confirm('Remover este dano?')){await call('del_dano',{id});await recarregar()}};


// ---------- KM editar ----------
$('#kmEdit').onclick=()=>{
  modalForm('Atualizar hodômetro',`<div class="fg"><label>KM atual</label>
    <input id="f_km" type="number" value="${Math.round(KM)}" style="font-family:'JetBrains Mono';font-size:20px;font-weight:700"></div>`,
    async()=>{await call('set_km',{km_atual:$('#f_km').value});fecharModal();toast('Hodômetro atualizado');await recarregar();});
};

// ---------- Sair / reconfigurar ----------
$('#btnSair').onclick=()=>{
  if(confirm('Desconectar deste aparelho? Você precisará informar a URL e a senha novamente. (Seus dados na planilha não são afetados.)')){
    localStorage.removeItem('gs_url');localStorage.removeItem('gs_senha');location.reload();
  }
};

// ---------- modal ----------
function modalForm(titulo,html,onSave,onDel){
  $('#modal').innerHTML=`<h3>${titulo}</h3>${html}<div class="mbtns">
    ${onDel?'<button class="cancel" id="mDel" style="color:var(--red)">Excluir</button>':''}
    <button class="cancel" id="mCancel">Cancelar</button>
    <button class="save" id="mSave">Salvar</button></div>`;
  $('#ov').classList.add('on');
  $('#mCancel').onclick=fecharModal;
  $('#mSave').onclick=async()=>{const b=$('#mSave');b.disabled=true;b.textContent='Salvando...';
    try{await onSave();}catch(e){toast('Erro ao salvar');b.disabled=false;b.textContent='Salvar';}};
  if(onDel)$('#mDel').onclick=onDel;
}
function fecharModal(){$('#ov').classList.remove('on')}
$('#ov').onclick=e=>{if(e.target.id==='ov')fecharModal()};
function hoje(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

// ---------- inicialização / login Firebase ----------
$('#cfgBtn').onclick=async()=>{
  const email=$('#cfgUrl').value.trim(), senha=$('#cfgSenha').value;
  const erro=$('#setupErro');
  if(!email||!senha){erro.style.display='block';erro.textContent='Preencha o e-mail e a senha.';return;}
  const btn=$('#cfgBtn');btn.disabled=true;btn.textContent='Entrando...';
  try{
    await fbLogin(email,senha);   // a sessão fica salva; onAuth cuida do resto
  }catch(e){
    erro.style.display='block';
    erro.textContent='E-mail ou senha incorretos.';
    btn.disabled=false;btn.textContent='Entrar';
  }
};

// Reage ao estado de login: entrou -> carrega e mostra; saiu -> mostra login.
fbOnAuth(async(user)=>{
  if(user){
    try{
      await recarregar();
      document.body.classList.add('pronto');
      loadDash();
    }catch(e){
      const erro=$('#setupErro');
      erro.style.display='block';
      erro.textContent='Conectei, mas falhei ao carregar os dados. Tente recarregar a página.';
    }
  }else{
    document.body.classList.remove('pronto');
    const btn=$('#cfgBtn');if(btn){btn.disabled=false;btn.textContent='Entrar';}
  }
});
