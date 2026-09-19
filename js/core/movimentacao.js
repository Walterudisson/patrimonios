export function ehPerfilValidador(perfil) {
  return perfil === 'admin' || perfil === 'gestor';
}

export function prepararAtualizacaoPatrimonio({
  item,
  localizacaoDestino,
  usuario,
  observacao = '',
  dataHora
}) {
  if (!item || !localizacaoDestino || !usuario || !dataHora) {
    throw new Error('Dados insuficientes para preparar a atualização patrimonial.');
  }

  const divisaoOriginal = item.divisaoOrigem || item.divisao;
  const localizacaoAnterior = item.localizacaoAtual || divisaoOriginal;
  const houveMudanca = localizacaoAnterior !== localizacaoDestino;
  const perfilValidador = ehPerfilValidador(usuario.perfil);
  const acao = houveMudanca
    ? (perfilValidador ? 'transferencia_validada' : 'transferencia_solicitada')
    : 'conferencia';

  const historico = [
    ...(item.historico || []),
    {
      local: localizacaoDestino,
      data: dataHora,
      responsavel: `${usuario.nome} (${usuario.email})`,
      obs: observacao,
      acao
    }
  ];

  const dadosAtualizacao = {
    localizado: true,
    divisaoOrigem: divisaoOriginal,
    observacaoAtual: observacao,
    dataLocalizacao: dataHora,
    conferidoPor: usuario.email,
    historico
  };

  if (houveMudanca && !perfilValidador) {
    dadosAtualizacao.statusTransferencia = 'pendente';
    dadosAtualizacao.divisaoDestinoSugerida = localizacaoDestino;
  } else {
    dadosAtualizacao.localizacaoAtual = localizacaoDestino;
    dadosAtualizacao.divisaoDestinoSugerida = '';
    dadosAtualizacao.statusTransferencia = houveMudanca ? 'aprovado' : 'concluido';
  }

  return {
    dadosAtualizacao,
    houveMudanca,
    perfilValidador,
    localizacaoAnterior,
    acao
  };
}
