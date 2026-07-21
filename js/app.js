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
  console.time('DIAG call '+acao);
  const r=await escreverFirestore(acao,extra||{});
  console.timeEnd('DIAG call '+acao);
  return r;
}
// Recarrega todos os dados do Firestore e atualiza a tela atual.
async function recarregar(){
  console.time('DIAG recarregar');
  console.time('DIAG carregarTudo');
  DADOS=await carregarTudoFirestore();
  console.timeEnd('DIAG carregarTudo');
  KM=DADOS.km_atual;
  $('#kmVal').textContent=fmt(KM);
  $('#veic').textContent=DADOS.veiculo||'';
  const cur=document.querySelector('nav.tabs button.on').dataset.v;
  ({dash:loadDash,todas:loadTodas,pend:loadPend,hist:loadHist,compras:loadCompras,ref:loadRef,corpo:loadCorpo})[cur]();
  atualizarSino();
  console.timeEnd('DIAG recarregar');
}

// ---------- ALERTAS (sino) ----------
// Dispensas ficam no navegador: { "<id>": "<faixa>" } — a faixa em que foi dispensada.
function _getDispensas(){try{return JSON.parse(localStorage.getItem('alertasDispensados')||'{}');}catch(e){return {};}}
function _setDispensas(d){localStorage.setItem('alertasDispensados',JSON.stringify(d));}
function _faixaDe(rd){return rd<0?'venc':(rd<=15?'d15':(rd<=30?'d30':null));}

// Classifica tarefas por urgência de tempo. Só entram tarefas com
// periodicidade (freq_dias) maior que 30 dias. Dispensadas na MESMA faixa saem.
function calcularAlertas(){
  const disp=_getDispensas();
  const venc=[],d15=[],d30=[];
  (DADOS.tarefas||[]).forEach(t=>{
    const rd=t.rest_dias;
    if(rd==null)return;                       // sem prazo por dias
    if(!(num(t.freq_dias)>30))return;          // só periodicidade > 30 dias
    const faixa=_faixaDe(rd);
    if(!faixa)return;                          // mais de 30 dias no futuro
    if(disp[String(t.id)]===faixa)return;      // dispensada nesta faixa
    if(faixa==='venc')venc.push(t);
    else if(faixa==='d15')d15.push(t);
    else d30.push(t);
  });
  const ord=(a,b)=>(a.rest_dias)-(b.rest_dias);
  return {venc:venc.sort(ord),d15:d15.sort(ord),d30:d30.sort(ord)};
}
// Dispensa um alerta na faixa atual; volta se a tarefa piorar de faixa.
function dispensarAlerta(id){
  const t=(DADOS.tarefas||[]).find(x=>String(x.id)===String(id));
  if(!t)return;
  const faixa=_faixaDe(t.rest_dias);
  if(!faixa)return;
  const d=_getDispensas();d[String(id)]=faixa;_setDispensas(d);
  atualizarSino();abrirAlertas();             // re-renderiza a lista sem o item
}
function atualizarSino(){
  const a=calcularAlertas();
  const n=a.venc.length+a.d15.length+a.d30.length;
  const badge=$('#sinoBadge');
  if(!badge)return;
  if(n>0){badge.style.display='flex';badge.textContent=n;
    // vermelho se há vencidas, âmbar se só futuras
    badge.style.background=a.venc.length?'var(--red)':'var(--amber)';
  }else{badge.style.display='none';}
}
function abrirAlertas(){
  const a=calcularAlertas();
  const total=a.venc.length+a.d15.length+a.d30.length;
  if(total===0){
    modalForm('Alertas de manutenção',`<div class="empty" style="padding:20px 0">Nada chegando. Tudo em dia. 👌</div>`,null);
    $('#mSave').style.display='none';
    return;
  }
  const item=t=>{
    const rd=t.rest_dias;
    const txt=rd<0?`vencida há ${Math.abs(rd)} dias`:`em ${rd} dias`;
    const km=t.prox_km!=null?` · ${fmt(t.prox_km)} km`:'';
    return `<div class="alerta-item">
      <div class="alerta-body">
        <div class="alerta-t">${t.componente?t.componente+' — ':''}${t.tarefa||''}</div>
        <div class="alerta-m">${t.prox_data?fmtData(t.prox_data):''}${km} · <b>${txt}</b></div>
      </div>
      <button class="alerta-x" onclick="dispensarAlerta(${t.id})" title="Dispensar até mudar">✕</button>
    </div>`;
  };
  const bloco=(titulo,cor,arr)=>arr.length?`<div class="alerta-grupo">
    <div class="alerta-cab" style="color:${cor}">${titulo} (${arr.length})</div>
    ${arr.map(item).join('')}</div>`:'';
  const html=`<div class="alerta-lista">
    ${bloco('Vencidas','var(--red)',a.venc)}
    ${bloco('Vencem em até 15 dias','var(--amber)',a.d15)}
    ${bloco('Vencem em até 30 dias','var(--blue)',a.d30)}
  </div>`;
  modalForm('Alertas de manutenção',html,null);
  // o modal é só leitura: esconde o botão Salvar
  const sv=$('#mSave');if(sv)sv.style.display='none';
}

// ---------- navegação ----------
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  $('#v-'+b.dataset.v).classList.add('on');
  window.scrollTo(0,0);
  ({dash:loadDash,todas:loadTodas,pend:loadPend,hist:loadHist,compras:loadCompras,ref:loadRef,corpo:loadCorpo})[b.dataset.v]();
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
    <div class="extra">
      ${t.obs?`<div>📋 ${t.obs}</div>`:''}
      ${t.materiais?`<div class="mat">🔧 ${t.materiais}</div>`:''}
      <div style="color:var(--faint);margin-top:5px">Frequência: ${t.freq_km?fmt(t.freq_km)+' km':''} ${t.freq_dias?'/ '+fmt(t.freq_dias)+' dias':''} · Última: ${fmt(t.ult_km)} km em ${fmtData(t.ult_data)}</div>
    </div>
    <div class="acts">
      <button class="done" onclick="marcarFeita(${t.id})">✓ Fiz agora</button>
      ${full?`<button onclick="abrirTarefa(${t.id})">Editar</button>`:''}
      <button class="more" onclick="toggleExtra(this)">${(t.obs||t.materiais)?'detalhes ▾':'info ▾'}</button>
    </div>
  </div>`;
}
// Alterna o .extra do card a que o botão pertence (sem depender de id único).
function toggleExtra(btn){
  const card=btn.closest('.card');
  if(card){const ex=card.querySelector('.extra');if(ex)ex.classList.toggle('show');}
}

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
  $('#listNaoProg').innerHTML=np.map(n=>`<div class="row">
    <div class="chk" onclick="resolverNP(${n.id})" title="Marcar como resolvido">✓</div>
    <div class="body"><div class="t">${n.tarefa}</div>${n.obs?`<div class="s">${n.obs}</div>`:''}</div>
    <span class="prio" style="background:rgba(242,165,22,.13);color:var(--amber)">${n.prioridade}</span>
    <button class="x" onclick="delNP(${n.id})">×</button></div>`).join('')||'<div class="empty">Nenhuma pendência.</div>';
  const ins=DADOS.inspecoes;
  $('#listInspec').innerHTML=ins.map(i=>`<div class="row">
    <div class="chk" onclick="resolverIns(${i.id})" title="Marcar como resolvido">✓</div>
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

// Resolver uma melhoria/conserto: edita o texto, registra no histórico e remove da lista.
function resolverNP(id){
  const n=DADOS.nao_programadas.find(x=>String(x.id)===String(id));
  if(!n)return;
  const txtPad=n.tarefa||'';
  modalForm('Concluir e enviar ao histórico',`
    <div class="fg"><label>Descrição no histórico</label><textarea id="r_d" rows="2">${txtPad}</textarea></div>
    <div class="frow">
      <div class="fg"><label>Data</label><input id="r_dt" type="date" value="${hoje()}"></div>
      <div class="fg"><label>KM</label><input id="r_k" type="number" value="${Math.round(KM)}"></div>
    </div>`,
    async()=>{
      const desc=$('#r_d').value.trim()||txtPad;
      await call('add_historico',{descricao:desc,data:$('#r_dt').value,km:$('#r_k').value});
      await call('del_nao_prog',{id});
      fecharModal();await recarregar();
    });
}
// Resolver um ponto de inspeção: idem, usando problema (e solução, se houver).
function resolverIns(id){
  const i=DADOS.inspecoes.find(x=>String(x.id)===String(id));
  if(!i)return;
  let txtPad=i.problema||'';
  if(i.solucao)txtPad+=' — '+i.solucao;
  modalForm('Concluir e enviar ao histórico',`
    <div class="fg"><label>Descrição no histórico</label><textarea id="r_d" rows="2">${txtPad}</textarea></div>
    <div class="frow">
      <div class="fg"><label>Data</label><input id="r_dt" type="date" value="${hoje()}"></div>
      <div class="fg"><label>KM</label><input id="r_k" type="number" value="${Math.round(KM)}"></div>
    </div>`,
    async()=>{
      const desc=$('#r_d').value.trim()||txtPad;
      await call('add_historico',{descricao:desc,data:$('#r_dt').value,km:$('#r_k').value});
      await call('del_inspecao',{id});
      fecharModal();await recarregar();
    });
}
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
// Origem de um registro: usa o campo 'origem' ou, em registros antigos,
// deduz pelo prefixo "[Manutenção]" (gravado pelas tarefas programadas).
function origemHist(r){
  if(r.origem==='auto'||r.origem==='manual')return r.origem;
  return String(r.descricao||'').indexOf('[Manutenção]')===0?'auto':'manual';
}
let _filtroHist=localStorage.getItem('filtroHist')||'todos';
function setFiltroHist(f){_filtroHist=f;localStorage.setItem('filtroHist',f);loadHist();}

function loadHist(){
  let h=DADOS.historico.slice().reverse();
  if(_filtroHist==='manual')h=h.filter(r=>origemHist(r)==='manual');
  else if(_filtroHist==='auto')h=h.filter(r=>origemHist(r)==='auto');
  const fb=(v,txt)=>`<button class="filtro-btn${_filtroHist===v?' on':''}" onclick="setFiltroHist('${v}')">${txt}</button>`;
  const barra=`<div class="export-bar">
    <button class="export-btn" onclick="exportarPDF()">📄 PDF de histórico</button>
    <button class="export-btn" onclick="exportarBackup()">💾 Backup completo</button>
  </div>
  <div class="filtro-bar">${fb('todos','Todos')}${fb('manual','Manuais')}${fb('auto','Automáticos')}</div>`;
  $('#listHist').innerHTML=barra+(h.map(r=>`<div class="row">
    <div class="body"><div class="t">${r.descricao||''}</div>
    <div class="meta">${fmtData(r.data)} · ${r.km?fmt(r.km)+' km':'—'}${origemHist(r)==='auto'?' · <span style="color:var(--faint)">programada</span>':''}</div></div>
    <button class="x" onclick="editarHist(${r.id})" style="color:var(--muted);font-size:18px">✎</button>
    <button class="x" onclick="delHist(${r.id})">×</button></div>`).join('')||'<div class="empty">Nada neste filtro.</div>');
  const c=DADOS.consumo;
  const max=Math.max(...c.map(x=>+x.consumo_medio||0),1);
  $('#listConsumo').innerHTML=c.slice().reverse().map(x=>`<div class="row">
    <div class="body"><div class="t">${x.consumo_medio?(+x.consumo_medio).toFixed(2):'—'} km/L
      <span style="color:var(--faint);font-weight:400;font-size:13px">· ${fmtData(x.data)}</span></div>
    <div class="meta">${fmt(x.percorrido)} km · ${x.consumo?(+x.consumo).toFixed(1)+' L':''} ${x.obs?'· '+x.obs:''}</div>
    <div class="bar"><i style="width:${(+x.consumo_medio||0)/max*100}%"></i></div></div>
    <button class="x" onclick="editarConsumo(${x.id})" style="color:var(--muted);font-size:18px">✎</button>
    <button class="x" onclick="delConsumo(${x.id})">×</button></div>`).join('')||'<div class="empty">Sem registros de consumo.</div>';
}
// Editar um abastecimento existente.
function editarConsumo(id){
  const x=(DADOS.consumo||[]).find(r=>String(r.id)===String(id));
  if(!x)return;
  modalForm('Editar abastecimento',`
    <div class="frow">
      <div class="fg"><label>KM anterior</label><input id="f_ka" type="number" value="${x.km_ant||''}"></div>
      <div class="fg"><label>KM agora</label><input id="f_kn" type="number" value="${x.km||''}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Litros abastecidos</label><input id="f_l" type="number" step="0.01" value="${x.consumo||''}"></div>
      <div class="fg"><label>Data</label><input id="f_dt" type="date" value="${(String(x.data).match(/\d{4}-\d{2}-\d{2}/)||[hoje()])[0]}"></div>
    </div>
    <div class="fg"><label>Observação</label><input id="f_o" value="${(x.obs||'').replace(/"/g,'&quot;')}"></div>`,
    async()=>{await call('edit_consumo',{id,km_ant:$('#f_ka').value,km:$('#f_kn').value,consumo:$('#f_l').value,
      data:$('#f_dt').value,obs:$('#f_o').value});fecharModal();await recarregar()});
}
const delConsumo=async id=>{if(confirm('Excluir abastecimento?')){await call('del_consumo',{id});await recarregar()}};
const delHist=async id=>{if(confirm('Excluir registro?')){await call('del_historico',{id});await recarregar()}};
// Editar um registro do histórico (descrição, data, km).
function editarHist(id){
  const r=DADOS.historico.find(x=>String(x.id)===String(id));
  if(!r)return;
  modalForm('Editar registro',`
    <div class="fg"><label>Descrição</label><textarea id="e_d" rows="2">${(r.descricao||'').replace(/"/g,'&quot;')}</textarea></div>
    <div class="frow">
      <div class="fg"><label>Data</label><input id="e_dt" type="date" value="${(String(r.data).match(/\d{4}-\d{2}-\d{2}/)||[hoje()])[0]}"></div>
      <div class="fg"><label>KM</label><input id="e_k" type="number" value="${r.km||''}"></div>
    </div>`,
    async()=>{
      await call('edit_historico',{id,descricao:$('#e_d').value,data:$('#e_dt').value,km:$('#e_k').value});
      fecharModal();await recarregar();
    });
}
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
  // KM anterior = maior km já registrado (robusto a ordem dos dados)
  const ultKm=c.length?Math.max(...c.map(x=>num(x.km)||0)):'';
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

// ---------- COMPRAS ----------
function loadCompras(){
  const itens=DADOS.compras||[];
  $('#listCompras').innerHTML=itens.length?itens.map(c=>`<div class="row">
    <div class="chk" onclick="comprarItem(${c.id})" title="Marcar como comprado">✓</div>
    <div class="body"><div class="t">${c.nome||''}${c.qtd?` <span style="color:var(--muted)">×${c.qtd}</span>`:''}</div>
    ${(c.modelo||c.obs)?`<div class="s">${c.modelo||''}${c.modelo&&c.obs?' · ':''}${c.obs||''}</div>`:''}</div>
    <button class="x" onclick="delCompra(${c.id})">×</button></div>`).join(''):'<div class="empty">Lista vazia. Adicione itens ou use as sugestões abaixo.</div>';

  // Sugestões: materiais das tarefas (texto livre), separados por vírgula,
  // que ainda não estão na lista de compras. Prioriza tarefas vencidas/próximas.
  const naLista=new Set(itens.map(c=>(c.nome||'').trim().toLowerCase()));
  const sug=[];const vistos=new Set();
  (DADOS.tarefas||[]).slice().sort((a,b)=>(a.ordem||9e9)-(b.ordem||9e9)).forEach(t=>{
    if(!t.materiais)return;
    String(t.materiais).split(/[,;]/).map(s=>s.trim()).filter(Boolean).forEach(mat=>{
      const k=mat.toLowerCase();
      if(naLista.has(k)||vistos.has(k))return;
      vistos.add(k);
      sug.push({mat,tarefa:t.tarefa,status:t.status});
    });
  });
  $('#listSugestoes').innerHTML=sug.length?sug.map((s,idx)=>`<div class="row">
    <div class="body"><div class="t">${s.mat}</div>
    <div class="s">de: ${s.tarefa}${s.status==='Vencido'?' · <span style="color:var(--red)">vencida</span>':s.status==='Próximo'?' · <span style="color:var(--amber)">próxima</span>':''}</div></div>
    <button class="addbtn" style="padding:6px 12px;font-size:13px" onclick="addSugestao(${idx})">＋ Adicionar</button></div>`).join(''):'<div class="empty">Nenhum material pendente nas tarefas.</div>';
  window._sugestoes=sug;   // guarda para addSugestao usar por índice
}
function abrirCompra(){
  modalForm('Novo item',`
    <div class="fg"><label>Nome</label><input id="c_n"></div>
    <div class="fg"><label>Modelo</label><input id="c_m"></div>
    <div class="frow">
      <div class="fg"><label>Quantidade</label><input id="c_q" type="number" min="1" value="1"></div>
    </div>
    <div class="fg"><label>Observação</label><input id="c_o"></div>`,
    async()=>{await call('add_compra',{nome:$('#c_n').value,modelo:$('#c_m').value,qtd:$('#c_q').value,obs:$('#c_o').value});
      fecharModal();await recarregar()});
}
// Adiciona uma sugestão (por índice) como item da lista, pré-preenchendo o nome.
function addSugestao(idx){
  const s=(window._sugestoes||[])[idx];
  const nome=s?s.mat:'';
  modalForm('Adicionar à lista',`
    <div class="fg"><label>Nome</label><input id="c_n" value="${nome.replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label>Modelo</label><input id="c_m"></div>
    <div class="frow">
      <div class="fg"><label>Quantidade</label><input id="c_q" type="number" min="1" value="1"></div>
    </div>
    <div class="fg"><label>Observação</label><input id="c_o"></div>`,
    async()=>{await call('add_compra',{nome:$('#c_n').value,modelo:$('#c_m').value,qtd:$('#c_q').value,obs:$('#c_o').value});
      fecharModal();await recarregar()});
}
const comprarItem=async id=>{await call('del_compra',{id});await recarregar()};
const delCompra=async id=>{if(confirm('Remover item?')){await call('del_compra',{id});await recarregar()}};

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
  $('#mSave').onclick=async()=>{
    const b=$('#mSave');b.disabled=true;b.textContent='Salvando...';
    console.log('[SAVE] início');const _t0=Date.now();
    let resolvido=false;
    const seguranca=setTimeout(()=>{
      if(!resolvido){console.warn('[SAVE] TIMEOUT 5s disparou — algo travou');fecharModal();recarregar();toast('Salvo. Sincroniza quando houver sinal.');}
    },5000);
    try{
      await onSave();
      console.log('[SAVE] onSave concluído em',Date.now()-_t0,'ms');
      resolvido=true;clearTimeout(seguranca);
    }catch(e){
      console.error('[SAVE] erro:',e);
      resolvido=true;clearTimeout(seguranca);
      toast('Erro ao salvar');b.disabled=false;b.textContent='Salvar';
    }
  };
  if(onDel)$('#mDel').onclick=onDel;
}
function fecharModal(){$('#ov').classList.remove('on')}
$('#ov').onclick=e=>{if(e.target.id==='ov')fecharModal()};
function hoje(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

// ---------- inicialização / login Firebase ----------
$('#cfgBtn').onclick=async()=>{
  const erro=$('#setupErro');erro.style.display='none';
  const btn=$('#cfgBtn');btn.disabled=true;btn.textContent='Abrindo o Google...';
  try{
    await fbLogin();   // popup do Google; a sessão fica salva; onAuth cuida do resto
  }catch(e){
    erro.style.display='block';
    erro.textContent=(e&&e.code==='auth/popup-closed-by-user')?'Login cancelado.':'Não consegui entrar com o Google. Tente de novo.';
    btn.disabled=false;btn.textContent='Entrar com Google';
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
    const btn=$('#cfgBtn');if(btn){btn.disabled=false;btn.textContent='Entrar com Google';}
  }
});
