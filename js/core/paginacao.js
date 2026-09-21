export async function carregarPaginaIntercalada({ fontes, tamanhoPagina, carregarLote, incluirItem = () => true }) {
  const pagina = [];
  const vistos = new Set();

  while (pagina.length < tamanhoPagina) {
    await Promise.all(fontes.filter(fonte => !fonte.esgotada && fonte.buffer.length === 0).map(async fonte => {
      const { itens, cursor, esgotada } = await carregarLote(fonte);
      fonte.buffer = itens;
      fonte.cursor = cursor;
      fonte.esgotada = esgotada;
    }));

    const proximos = fontes.map(fonte => fonte.buffer[0]).filter(Boolean);
    if (proximos.length === 0) break;
    const proximo = proximos.reduce((menor, item) => item.id < menor.id ? item : menor);
    fontes.forEach(fonte => {
      if (fonte.buffer[0]?.id === proximo.id) fonte.buffer.shift();
    });
    if (!vistos.has(proximo.id) && incluirItem(proximo)) pagina.push(proximo);
    vistos.add(proximo.id);
  }

  return {
    pagina,
    temMais: fontes.some(fonte => fonte.buffer.length > 0 || !fonte.esgotada)
  };
}
