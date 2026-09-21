export function situacaoPatrimonio(item) {
  if (item.statusTransferencia === 'pendente') return 'aguardando';
  return item.localizado ? 'localizados' : 'pendentes';
}

export function divisoesVisiveisPatrimonio(item) {
  const divisoes = [item.divisaoOrigem, item.divisao, item.localizacaoAtual];
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
