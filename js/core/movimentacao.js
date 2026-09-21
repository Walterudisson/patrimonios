export function ehPerfilValidador(perfil) {
  return perfil === 'admin' || perfil === 'gestor';
}

export function prepararAtualizacaoPatrimonio({
  item,
  localizacaoDestino,
  usuario,
  observacao = '',
  metodoLocalizacao,
  dataHora
}) {
  if (!item || !localizacaoDestino || !usuario || !dataHora) {
    throw new Error('Dados insuficientes para preparar a atualização patrimonial.');
  }

  const divisaoOriginal = item.divisaoOrigem || item.divisao;
  const localizacaoAnterior = item.localizacaoAtual || divisaoOriginal;
  if (item.statusTransferencia === 'pendente') {
    throw new Error('Este patrimônio já possui uma transferência aguardando aprovação.');
  }
  if (!['codigo_barras', 'ocr', 'digitacao'].includes(metodoLocalizacao)) {
    throw new Error('Informe como a plaqueta foi localizada.');
  }
  const houveMudanca = localizacaoAnterior !== localizacaoDestino;
  const perfilValidador = ehPerfilValidador(usuario.perfil);
  const acao = houveMudanca ? 'transferencia_solicitada' : 'conferencia';

  const historico = [
    ...(item.historico || []),
    {
      local: localizacaoDestino,
      data: dataHora,
      responsavel: `${usuario.nome} (${usuario.email})`,
      metodoLocalizacao,
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

  if (houveMudanca) {
    dadosAtualizacao.statusTransferencia = 'pendente';
    dadosAtualizacao.divisaoDestinoSugerida = localizacaoDestino;
  } else {
    dadosAtualizacao.localizacaoAtual = localizacaoDestino;
    dadosAtualizacao.divisaoDestinoSugerida = '';
    dadosAtualizacao.statusTransferencia = 'concluido';
  }

  return {
    dadosAtualizacao,
    houveMudanca,
    perfilValidador,
    localizacaoAnterior,
    acao
  };
}

export function prepararResolucaoTransferencia({ item, usuario, decisao, dataHora }) {
  if (!item || !usuario || !dataHora || !['aprovar', 'rejeitar'].includes(decisao)) {
    throw new Error('Dados insuficientes para resolver a transferência.');
  }
  if (!ehPerfilValidador(usuario.perfil)) {
    throw new Error('Somente perfis validadores podem resolver transferências.');
  }
  if (item.statusTransferencia !== 'pendente') {
    throw new Error('A transferência informada não está mais pendente.');
  }

  const divisaoOriginal = item.divisaoOrigem || item.divisao;
  const localizacaoAnterior = item.localizacaoAtual || divisaoOriginal;
  const destinoSugerido = item.divisaoDestinoSugerida || '';
  const aprovada = decisao === 'aprovar';
  if (aprovada && !destinoSugerido) {
    throw new Error('A transferência pendente não possui destino sugerido.');
  }

  const localizacaoEfetiva = aprovada ? destinoSugerido : localizacaoAnterior;
  const acao = aprovada ? 'transferencia_aprovada' : 'transferencia_rejeitada';
  const historico = [
    ...(item.historico || []),
    {
      local: localizacaoEfetiva,
      destinoSugerido,
      data: dataHora,
      responsavel: `${usuario.nome} (${usuario.email})`,
      obs: aprovada
        ? `Transferência para ${destinoSugerido} aprovada.`
        : `Transferência para ${destinoSugerido || 'destino não informado'} rejeitada; localização atual mantida.`,
      acao
    }
  ];

  return {
    dadosAtualizacao: {
      localizacaoAtual: localizacaoEfetiva,
      divisaoDestinoSugerida: '',
      statusTransferencia: aprovada ? 'aprovado' : 'rejeitado',
      historico
    },
    localizacaoAnterior,
    localizacaoEfetiva,
    destinoSugerido,
    acao
  };
}
