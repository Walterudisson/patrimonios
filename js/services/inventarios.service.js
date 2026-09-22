import {
  collection, doc, getCountFromServer, getDocFromServer, getDocsFromServer,
  query, runTransaction, serverTimestamp, where, or, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from '../config/firebase.js';
import { chaveInventarioDivisao, validarNomeDivisao } from '../core/inventario-id.js?v=1.13.6';

const referencia = divisao => doc(db, 'inventarios', chaveInventarioDivisao(divisao));
const localEfetivo = item => item.localizacaoAtual || item.divisaoOrigem || item.divisao || '';
const identificador = () => globalThis.crypto.randomUUID();

export async function consultarCicloDivisao(divisao) {
  validarNomeDivisao(divisao);
  const snap = await getDocFromServer(referencia(divisao));
  return snap.exists() ? snap.data() : { divisao, ciclo: 1, estado: 'aberto', iniciadoEm: null };
}

export async function divisoesDoInventarioAtual() {
  const [catalogo, patrimonios] = await Promise.all([
    getDocsFromServer(collection(db, 'divisoes')),
    getDocsFromServer(collection(db, 'patrimonios'))
  ]);
  const nomes = new Set(catalogo.docs.map(item => item.data())
    .filter(item => item.ativo !== false && item.nome).map(item => item.nome));
  patrimonios.docs.forEach(item => {
    const divisao = localEfetivo(item.data());
    if (divisao) nomes.add(divisao);
  });
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function listarFechamentos(divisao) {
  validarNomeDivisao(divisao);
  const snap = await getDocsFromServer(collection(referencia(divisao), 'fechamentos'));
  return snap.docs.map(documento => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (b.encerradoEm?.toMillis?.() || 0) - (a.encerradoEm?.toMillis?.() || 0));
}

export async function listarItensFechamento(divisao, fechamentoId) {
  validarNomeDivisao(divisao);
  return (await getDocsFromServer(collection(referencia(divisao), 'fechamentos', fechamentoId, 'itens')))
    .docs.map(item => ({ ...item.data(), plaqueta: item.id }))
    .sort((a, b) => String(a.plaqueta).localeCompare(String(b.plaqueta), 'pt-BR', { numeric: true }));
}

async function pendenciasDaDivisao(divisao) {
  const snap = await getDocsFromServer(query(collection(db, 'patrimonios'), where('statusTransferencia', '==', 'pendente')));
  return snap.docs.filter(item => localEfetivo(item.data()) === divisao
    || item.data().divisaoDestinoSugerida === divisao);
}

async function itensEfetivos(divisao) {
  const snap = await getDocsFromServer(query(collection(db, 'patrimonios'), or(
    where('divisaoOrigem', '==', divisao),
    where('divisao', '==', divisao),
    where('localizacaoAtual', '==', divisao)
  )));
  return snap.docs.filter(item => localEfetivo(item.data()) === divisao);
}

async function iniciarEncerramento(divisao, usuario) {
  const ref = referencia(divisao);
  return runTransaction(db, async transacao => {
    const atual = await transacao.get(ref);
    const dados = atual.exists() ? atual.data() : null;
    if (dados?.estado === 'encerrado') throw new Error('Esta divisão já foi encerrada. Reabra-a para fazer correções.');
    if (dados?.estado === 'reiniciando') throw new Error('Esta divisão está iniciando um novo ciclo. Conclua essa operação antes.');
    if (dados?.estado === 'encerrando') {
      transacao.update(ref, { operadorUid: usuario.uid, alteradoEm: serverTimestamp() });
      return dados.fechamentoId;
    }
    const fechamentoId = identificador();
    const novosDados = {
      divisao, ciclo: dados?.ciclo || 1, cicloChave: dados?.cicloChave || 'ciclo-1',
      iniciadoEm: dados?.iniciadoEm || null, estado: 'encerrando', fechamentoId,
      operadorUid: usuario.uid, alteradoEm: serverTimestamp()
    };
    if (atual.exists()) transacao.update(ref, novosDados);
    else transacao.set(ref, novosDados);
    return fechamentoId;
  });
}

async function cancelarEncerramentoSemItens(divisao, fechamentoId) {
  const ref = referencia(divisao);
  const arquivados = await getCountFromServer(collection(ref, 'fechamentos', fechamentoId, 'itens'));
  if (arquivados.data().count) return;
  await runTransaction(db, async transacao => {
    const atual = await transacao.get(ref);
    if (atual.data()?.estado === 'encerrando' && atual.data().fechamentoId === fechamentoId) {
      transacao.update(ref, { estado: 'aberto', fechamentoId: '', alteradoEm: serverTimestamp() });
    }
  });
}

export async function encerrarDivisao(divisao, usuario) {
  validarNomeDivisao(divisao);
  if ((await pendenciasDaDivisao(divisao)).length) {
    throw new Error('Resolva as transferências pendentes de origem ou destino desta divisão antes de encerrá-la.');
  }
  const fechamentoId = await iniciarEncerramento(divisao, usuario);
  const ref = referencia(divisao);
  const fechamentoRef = doc(ref, 'fechamentos', fechamentoId);
  try {
    if ((await pendenciasDaDivisao(divisao)).length) {
      await cancelarEncerramentoSemItens(divisao, fechamentoId);
      throw new Error('Uma transferência foi registrada durante o encerramento. Resolva-a e tente novamente.');
    }
    const itens = await itensEfetivos(divisao);
    const anteriores = await getDocsFromServer(collection(fechamentoRef, 'itens'));
    const idsSalvos = new Set(anteriores.docs.map(item => item.id));
    const faltantes = itens.filter(item => !idsSalvos.has(item.id));
    for (let i = 0; i < faltantes.length; i += 100) {
      const lote = writeBatch(db);
      faltantes.slice(i, i + 100).forEach(item => lote.set(doc(fechamentoRef, 'itens', item.id), {
        ...item.data(), plaqueta: item.id,
        localizacaoEfetivaNoEncerramento: divisao
      }));
      await lote.commit();
    }
    const conferencia = await getDocsFromServer(collection(fechamentoRef, 'itens'));
    const idsEsperados = new Set(itens.map(item => item.id));
    if (conferencia.size !== itens.length || conferencia.docs.some(item => !idsEsperados.has(item.id))) {
      throw new Error('A fotografia dos itens não confere. Repita o encerramento para completar os registros.');
    }
    const localizados = itens.filter(item => item.data().localizado === true).length;
    const resultado = { total: itens.length, localizados, pendentes: itens.length - localizados };
    await runTransaction(db, async transacao => {
      const atual = await transacao.get(ref);
      if (atual.data()?.estado !== 'encerrando' || atual.data().fechamentoId !== fechamentoId) {
        throw new Error('O estado da divisão mudou. Atualize os dados antes de tentar novamente.');
      }
      transacao.set(fechamentoRef, {
        divisao, ciclo: atual.data().ciclo, fechamentoId, ...resultado,
        encerradoPorUid: usuario.uid, encerradoPorNome: usuario.nome,
        encerradoPorEmail: usuario.email, encerradoEm: serverTimestamp(),
        iniciadoEm: atual.data().iniciadoEm || null
      });
      transacao.update(ref, { estado: 'encerrado', operadorUid: usuario.uid, alteradoEm: serverTimestamp() });
    });
    return resultado;
  } catch (erro) {
    // A etapa intermediária permanece bloqueada para permitir retomada sem perder a fotografia.
    throw erro;
  }
}

export async function reabrirDivisao(divisao, motivo, usuario) {
  validarNomeDivisao(divisao);
  if (!motivo?.trim()) throw new Error('Informe a justificativa da reabertura.');
  const ref = referencia(divisao);
  const eventoId = identificador();
  await runTransaction(db, async transacao => {
    const atual = await transacao.get(ref);
    if (atual.data()?.estado !== 'encerrado') throw new Error('Somente uma divisão encerrada pode ser reaberta.');
    const geral = await transacao.get(doc(db, 'inventariosGerais', atual.data().cicloChave));
    if (geral.exists()) throw new Error('O inventário geral já foi encerrado. Inicie o próximo ciclo antes de fazer novas conferências.');
    const evento = {
      tipo: 'reabertura', fechamentoId: atual.data().fechamentoId,
      motivo: motivo.trim(), usuarioUid: usuario.uid, usuarioNome: usuario.nome,
      usuarioEmail: usuario.email, registradoEm: serverTimestamp()
    };
    transacao.update(ref, {
      estado: 'aberto', ultimaReabertura: { id: eventoId, ...evento },
      operadorUid: usuario.uid, alteradoEm: serverTimestamp()
    });
    transacao.set(doc(ref, 'eventos', eventoId), evento);
  });
}

export async function listarEventosInventario(divisao) {
  validarNomeDivisao(divisao);
  return (await getDocsFromServer(collection(referencia(divisao), 'eventos')))
    .docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function reiniciarDivisaoEncerrada(divisao, usuario) {
  validarNomeDivisao(divisao);
  const ref = referencia(divisao);
  await runTransaction(db, async transacao => {
    const atual = await transacao.get(ref);
    if (!['encerrado', 'reiniciando'].includes(atual.data()?.estado)) {
      throw new Error('Encerre a divisão e grave seu histórico antes de iniciar o próximo ciclo.');
    }
    const geral = await transacao.get(doc(db, 'inventariosGerais', atual.data().cicloChave));
    if (!geral.exists()) throw new Error('Encerre o inventário geral antes de iniciar o próximo ciclo.');
    if (atual.data().estado === 'encerrado') {
      transacao.update(ref, { estado: 'reiniciando', operadorUid: usuario.uid, alteradoEm: serverTimestamp() });
    } else {
      transacao.update(ref, { operadorUid: usuario.uid, alteradoEm: serverTimestamp() });
    }
  });
  const itens = await itensEfetivos(divisao);
  if (itens.some(item => item.data().statusTransferencia === 'pendente')) {
    throw new Error('Há transferências pendentes nesta divisão. Conclua a fila antes de retomar o reinício.');
  }
  for (let i = 0; i < itens.length; i += 100) {
    const lote = writeBatch(db);
    itens.slice(i, i + 100).forEach(item => lote.update(item.ref, {
      localizado: false, statusTransferencia: 'concluido', conferidoPor: '',
      observacaoAtual: 'Status revertido para pendente (Novo Ciclo)', dataLocalizacao: ''
    }));
    await lote.commit();
  }
  await runTransaction(db, async transacao => {
    const atual = await transacao.get(ref);
    if (atual.data()?.estado !== 'reiniciando') throw new Error('O reinício mudou de estado. Atualize a página.');
    transacao.update(ref, {
      estado: 'aberto', ciclo: atual.data().ciclo + 1,
      cicloChave: `ciclo-${atual.data().ciclo + 1}`,
      fechamentoId: '', iniciadoEm: serverTimestamp(),
      operadorUid: usuario.uid, alteradoEm: serverTimestamp()
    });
  });
  return itens.length;
}

export async function consultarEncerramentoGeral(ciclo) {
  const snap = await getDocFromServer(doc(db, 'inventariosGerais', `ciclo-${ciclo}`));
  return snap.exists() ? snap.data() : null;
}

export async function encerrarInventarioGeral(divisoes, usuario) {
  if (!divisoes.length) throw new Error('Não há divisões no catálogo para consolidar.');
  divisoes.forEach(validarNomeDivisao);
  const refs = [...new Set(divisoes)].sort().map(referencia);
  const registro = await runTransaction(db, async transacao => {
    const estados = [];
    for (const ref of refs) estados.push(await transacao.get(ref));
    const ciclo = estados[0].data()?.ciclo;
    if (!ciclo || estados.some(item => item.data()?.estado !== 'encerrado' || item.data()?.ciclo !== ciclo)) {
      throw new Error('Encerre todas as divisões do mesmo ciclo antes da consolidação geral.');
    }
    const geralRef = doc(db, 'inventariosGerais', `ciclo-${ciclo}`);
    const existente = await transacao.get(geralRef);
    if (existente.exists()) throw new Error('O inventário geral deste ciclo já foi encerrado.');
    const fechamentos = [];
    for (const estado of estados) {
      fechamentos.push(await transacao.get(doc(estado.ref, 'fechamentos', estado.data().fechamentoId)));
    }
    if (fechamentos.some(item => !item.exists())) throw new Error('Há uma divisão sem fotografia de encerramento.');
    const resumos = fechamentos.map(item => ({
      divisao: item.data().divisao, fechamentoId: item.id,
      total: item.data().total, localizados: item.data().localizados,
      pendentes: item.data().pendentes
    }));
    const totais = resumos.reduce((soma, item) => ({
      total: soma.total + item.total,
      localizados: soma.localizados + item.localizados,
      pendentes: soma.pendentes + item.pendentes
    }), { total: 0, localizados: 0, pendentes: 0 });
    transacao.set(geralRef, {
      ciclo, divisoes: resumos, ...totais,
      encerradoPorUid: usuario.uid, encerradoPorNome: usuario.nome,
      encerradoPorEmail: usuario.email, encerradoEm: serverTimestamp()
    });
    return { ciclo, ...totais };
  });
  return registro;
}

export async function listarInventariosGerais() {
  return (await getDocsFromServer(collection(db, 'inventariosGerais')))
    .docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => b.ciclo - a.ciclo);
}

export async function reiniciarInventarioGeral(divisoes, usuario) {
  const refs = [...new Set(divisoes)].map(referencia);
  if (!refs.length) throw new Error('Não há divisões para reiniciar.');
  const estados = await Promise.all(refs.map(ref => getDocFromServer(ref)));
  const ciclo = Math.min(...estados.map(item => item.data()?.ciclo || 0));
  if (!ciclo || !(await consultarEncerramentoGeral(ciclo))) {
    throw new Error('Encerre o inventário geral e grave o resultado antes de reiniciar.');
  }
  if (estados.some(item => !(
    (item.data()?.ciclo === ciclo && ['encerrado', 'reiniciando'].includes(item.data()?.estado))
    || (item.data()?.ciclo === ciclo + 1 && item.data()?.estado === 'aberto')
  ))) throw new Error('Há divisões em estados diferentes. Verifique o histórico antes de reiniciar.');
  let quantidade = 0;
  for (const estado of estados) {
    if (estado.data().ciclo === ciclo) {
      quantidade += await reiniciarDivisaoEncerrada(estado.data().divisao, usuario);
    }
  }
  return quantidade;
}
