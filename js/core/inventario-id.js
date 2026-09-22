export function validarNomeDivisao(divisao) {
  if (typeof divisao !== 'string' || !divisao.trim()) {
    throw new Error('Nome da divisão inválido para o histórico. Informe a administração do sistema.');
  }
}

export function chaveInventarioDivisao(divisao) {
  validarNomeDivisao(divisao);
  return divisao.replace(/%/g, '%25').replace(/\//g, '%2F');
}
