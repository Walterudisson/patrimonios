# Sprint 0.8 — câmera e leitura

## Objetivo

Tornar a leitura de etiquetas mais estável e compreensível em celulares e computadores, aproveitando os recursos oferecidos por cada câmera sem retirar as alternativas de OCR e digitação manual.

## Entregas

- Biblioteca `html5-qrcode` fixada na versão `2.3.8`, evitando mudanças inesperadas do CDN.
- Inicialização com estado visível e mensagens específicas para conexão insegura, permissão negada, câmera ausente ou dispositivo ocupado.
- Preferência automática pela câmera traseira e seletor para dispositivos com mais de uma câmera.
- Câmera escolhida preservada durante a sessão.
- Área de leitura responsiva para orientação vertical e horizontal.
- Foco contínuo solicitado quando informado pelo dispositivo.
- Zoom físico aplicado à lente quando suportado; aproximação visual identificada como alternativa nos demais dispositivos.
- Controle de lanterna exibido somente quando a câmera declara suporte.
- Gesto de pinça limitado ao visor da câmera.
- Feedback visual e vibração após leitura bem-sucedida.
- Scanner pausado após reconhecer uma plaqueta, evitando consultas duplicadas; o usuário pode selecionar `Ler outra plaqueta`.
- Retomada automática da leitura depois de uma conferência salva.
- Liberação da câmera ao trocar de aba, sair da conta ou colocar o app em segundo plano.
- Recuperação ao retornar ao app e reinicialização do enquadramento após mudança de orientação.
- OCR otimizado para a numeração: recorte central, escala de cinza, contraste, progresso percentual e seleção de candidatos numéricos plausíveis.
- Campo manual preparado para teclado numérico e busca pela tecla `Enter`.
- Novo módulo público `js/core/camera.js` com regras testáveis e sem dependência do DOM.

## Comportamento por compatibilidade

Recursos como zoom físico, foco contínuo e lanterna dependem do navegador, sistema operacional e câmera. O app detecta cada capacidade separadamente. Quando ela não existe, o restante da leitura continua funcionando.

A câmera exige HTTPS em produção. `localhost` continua válido para desenvolvimento. Se a câmera falhar, o usuário ainda pode usar OCR quando houver vídeo ativo ou digitar a plaqueta manualmente.

## Firestore

Esta sprint não altera consultas, gravações, índices ou regras do Firestore. Se as regras da Sprint 0.6/0.7 já estiverem publicadas, não é necessário republicá-las.

## Testes automatizados executados

- Cálculo responsivo da área de leitura.
- Escolha da câmera preferida e respeito à seleção salva.
- Limites e passos de zoom.
- Extração de candidatos de OCR, incluindo confusões comuns entre letras e números.
- Mensagens para permissão negada e contexto sem HTTPS.
- Verificação sintática de `app.js` e `js/core/camera.js`.
- Verificação dos IDs usados pelos controles no HTML.
- Verificação de separação entre pacote público e documentação interna.

## Testes manuais recomendados

1. Abrir o app por HTTPS em um celular e entrar na aba `Leitura`.
2. Confirmar que a câmera permanece desligada até tocar em `Ligar Câmera`.
3. Conceder permissão e confirmar preferência pela câmera traseira.
4. Se houver mais de uma câmera, trocar pelo seletor e confirmar reinicialização correta.
5. Ler uma etiqueta e confirmar feedback visual/vibração, preenchimento, consulta e pausa do scanner.
6. Tocar em `Ler outra plaqueta` e confirmar que a leitura retorna sem recarregar a página.
7. Ler e salvar uma conferência; confirmar que o scanner retoma automaticamente.
8. Testar o controle de zoom e, quando exibido, a lanterna.
9. Girar o celular e confirmar que a câmera volta com o enquadramento ajustado.
10. Com a câmera ativa, alternar para outro aplicativo e voltar; confirmar retomada.
11. Negar a permissão e conferir a mensagem orientativa, mantendo a digitação manual funcional.
12. Usar `Ler via OCR` com a numeração centralizada; confirmar progresso e candidato reconhecido.
13. Testar o OCR sem numeração clara e confirmar que o scanner volta a funcionar.
14. Digitar a plaqueta e usar `Enter` para realizar a busca.
15. Trocar de aba e confirmar que o indicador de uso da câmera do dispositivo é encerrado.

## Decisões futuras preservadas

- Sprint 0.9: modularização adicional e ampliação dos testes.
- Sprint 1.0: UX/layout mobile-first e desktop responsivo, botão `X` nas pesquisas e revisão do menu com hambúrguer/painel lateral no mobile e sidebar recolhível no desktop.
- Não criar botão `Carregar tudo` na Relação.

## Arquivos públicos

- `index.html`
- `app.js`
- `app.css`
- `assets/favicon.svg`
- `js/config/firebase.js`
- `js/core/camera.js`
- `js/core/firestore-metrics.js`
- `js/core/movimentacao.js`
- `js/services/divisoes.service.js`

## Arquivos internos

- `firestore.rules`
- `FIRESTORE-SETUP.md`
- `DECISOES-DE-PROJETO.md`
- `SPRINT-0.8.md`

Os arquivos internos não fazem parte do pacote destinado ao repositório público.
