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

export function prepararSugestaoDestino({ item, destino, usuario, observacao = '', dataHora }) {
  if (!item || !destino || !usuario || !dataHora) {
    throw new Error('Dados insuficientes para sugerir o destino.');
  }
  if (usuario.perfil !== 'conferente') {
    throw new Error('Somente Conferentes podem utilizar este fluxo.');
  }
  if (item.localizado === true) {
    throw new Error('O item já foi localizado. Utilize o fluxo normal de transferência.');
  }
  if (item.statusTransferencia === 'pendente' || item.sugestaoDestinoStatus === 'pendente') {
    throw new Error('Este patrimônio já possui uma solicitação aguardando aprovação.');
  }
  const origem = item.localizacaoAtual || item.divisaoOrigem || item.divisao || '';
  if (!origem || destino === origem) {
    throw new Error('Escolha uma divisão de destino diferente da localização atual.');
  }
  const responsavel = `${usuario.nome} (${usuario.email})`;
  const obs = observacao.trim();
  const historico = [
    ...(item.historico || []),
    {
      local: origem,
      destinoSugerido: destino,
      data: dataHora,
      responsavel,
      obs: obs || `Destino sugerido por: ${usuario.nome}`,
      acao: 'destino_sugerido'
    }
  ];
  return {
    sugestaoDestinoStatus: 'pendente',
    sugestaoDestinoDivisao: destino,
    sugestaoDestinoPor: { uid: usuario.uid, nome: usuario.nome, email: usuario.email },
    sugestaoDestinoEm: dataHora,
    sugestaoDestinoObservacao: obs,
    observacaoAtual: `Destino sugerido por: ${usuario.nome}${obs ? ` — ${obs}` : ''}`,
    historico
  };
}

export function prepararResolucaoSugestaoDestino({ item, usuario, decisao, dataHora }) {
  if (!item || !usuario || !dataHora || !['aprovar', 'rejeitar'].includes(decisao)) {
    throw new Error('Dados insuficientes para analisar a sugestão de destino.');
  }
  if (!ehPerfilValidador(usuario.perfil)) {
    throw new Error('Somente Gestores e Administradores podem analisar sugestões.');
  }
  if (item.sugestaoDestinoStatus !== 'pendente' || !item.sugestaoDestinoDivisao) {
    throw new Error('A sugestão de destino não está mais pendente.');
  }
  const origem = item.localizacaoAtual || item.divisaoOrigem || item.divisao || '';
  const destino = item.sugestaoDestinoDivisao;
  const aprovada = decisao === 'aprovar';
  const historico = [
    ...(item.historico || []),
    {
      local: aprovada ? destino : origem,
      destinoSugerido: destino,
      data: dataHora,
      responsavel: `${usuario.nome} (${usuario.email})`,
      obs: aprovada
        ? `Sugestão aprovada. O item permanece pendente de conferência física em ${destino}.`
        : `Sugestão de destino para ${destino} rejeitada; localização anterior mantida.`,
      acao: aprovada ? 'sugestao_destino_aprovada' : 'sugestao_destino_rejeitada'
    }
  ];
  return {
    localizado: false,
    ...(aprovada ? { localizacaoAtual: destino } : {}),
    sugestaoDestinoStatus: aprovada ? 'aprovada' : 'rejeitada',
    observacaoAtual: aprovada
      ? `Destino sugerido aprovado por ${usuario.nome}; aguardando conferência física.`
      : `Sugestão de destino rejeitada por ${usuario.nome}.`,
    historico
  };
}
