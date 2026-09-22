export function situacaoPatrimonio(item) {
  if (item.statusTransferencia === 'pendente') return 'aguardando';
  return item.localizado ? 'localizados' : 'pendentes';
}

export function divisoesVisiveisPatrimonio(item) {
  const divisoes = [item.localizacaoAtual || item.divisaoOrigem || item.divisao];
  if (situacaoPatrimonio(item) === 'aguardando') {
    divisoes.push(item.divisaoDestinoSugerida);
  }
  return [...new Set(divisoes.filter(Boolean))];
}

export function patrimonioVisivelParaDivisoes(item, divisoes) {
  return divisoesVisiveisPatrimonio(item).some(divisao => divisoes.includes(divisao));
}

export function correspondeSituacaoPatrimonio(item, filtro) {
  return filtro === 'todos' || situacaoPatrimonio(item) === filtro;
}

export function contarSituacoesPatrimonio(itens) {
  const contagens = { total: itens.length, localizados: 0, pendentes: 0, aguardando: 0 };
  itens.forEach(item => { contagens[situacaoPatrimonio(item)] += 1; });
  return contagens;
}

export function descontarItensForaDoEscopo(contagens, itensFora) {
  const saidas = contarSituacoesPatrimonio(itensFora);
  const total = Math.max(0, contagens.total - saidas.total);
  const localizados = Math.max(0, contagens.localizados - saidas.localizados);
  const aguardando = Math.max(0, contagens.aguardando - saidas.aguardando);
  return { total, localizados, pendentes: Math.max(0, total - localizados - aguardando), aguardando };
}

export function resumirProgressoDivisao(contagens, entradasPendentes) {
  const entradas = Math.max(0, entradasPendentes);
  const total = Math.max(0, contagens.total - entradas);
  const localizados = Math.min(total, contagens.localizados);
  const aguardando = Math.max(0, contagens.aguardando - entradas);
  return {
    total,
    localizados,
    aguardando,
    pendentes: Math.max(0, total - localizados - aguardando),
    entradas,
    percentual: total ? Math.round(localizados / total * 100) : 0
  };
}
