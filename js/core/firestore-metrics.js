const metricasFirestore = {
  documentosLidos: 0,
  leiturasAgregadasEstimadas: 0,
  operacoes: {}
};

function atualizarPainelMetricas() {
  const elemento = document.getElementById('firestore-metrics');
  if (!elemento) return;
  elemento.innerText = `Nesta aba: ${metricasFirestore.documentosLidos} documentos + ~${metricasFirestore.leiturasAgregadasEstimadas} leituras de agregação`;
}

export function registrarLeituras(operacao, documentos = 0, agregadasEstimadas = 0) {
  metricasFirestore.documentosLidos += documentos;
  metricasFirestore.leiturasAgregadasEstimadas += agregadasEstimadas;
  const atual = metricasFirestore.operacoes[operacao] || { documentos: 0, agregadasEstimadas: 0 };
  atual.documentos += documentos;
  atual.agregadasEstimadas += agregadasEstimadas;
  metricasFirestore.operacoes[operacao] = atual;
  atualizarPainelMetricas();
}

export function estimarLeiturasAgregacao(...contagens) {
  return contagens.reduce((total, quantidade) => total + Math.max(1, Math.ceil(quantidade / 1000)), 0);
}

export function obterMetricasFirestore() {
  return JSON.parse(JSON.stringify(metricasFirestore));
}
