export function divisoesDisponiveis(usuario, catalogo) {
  if (!usuario) return [];
  const divisoes = usuario.perfil === 'conferente'
    ? usuario.divisoesAtribuidas || []
    : catalogo;
  return [...new Set(divisoes.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function escopoInicial(usuario, catalogo, salvo = '') {
  const divisoes = divisoesDisponiveis(usuario, catalogo);
  if (salvo === 'todas' && (usuario?.perfil !== 'conferente' || divisoes.length > 1)) return salvo;
  if (divisoes.includes(salvo)) return salvo;
  if (usuario?.perfil !== 'conferente') return 'todas';
  return divisoes.length === 1 ? divisoes[0] : '';
}
