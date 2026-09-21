# Sprint 1.2 — fundação PWA

## Identificação

- Sprint: `1.2`
- Aplicação: `v1.12.0`
- Base: Sprint 1.1, revisão `v1.11.2`

## Objetivo

Formalizar o CM APP como Progressive Web App, controlando identidade, instalação, funcionamento em janela própria, disponibilidade do shell, estado de conexão e ciclo de atualização. A sprint não transforma as operações patrimoniais em operações offline.

## Entregas

### Instalação e identidade

- `manifest.webmanifest` com nome `CM APP`, escopo próprio e `display: standalone`.
- Ícones PNG de 192 × 192 e 512 × 512.
- Ícone `maskable` com área segura para recortes do Android.
- `apple-touch-icon` e metadados básicos para instalação em dispositivos Apple.
- Opção `INSTALAR CM APP` no menu e na página de perfil quando o navegador disponibiliza o fluxo nativo.
- Detecção de execução instalada para não oferecer uma segunda instalação.
- Uma recusa não gera nova oferta interna durante sete dias; o menu do navegador permanece disponível.

### Service worker e cache

- Cache versionado do shell local e das dependências estáticas necessárias para renderização.
- Navegações e arquivos de código usam prioridade para a rede, com cache como alternativa.
- O service worker ignora requisições que não sejam `GET`.
- Chamadas dinâmicas do Firestore, Authentication e Storage não são armazenadas pelo cache do app.
- `offline.html` orienta o usuário quando nem mesmo o shell principal estiver disponível.

### Conectividade

- Banner persistente informa quando o dispositivo está offline.
- A tela de login também informa que a conexão é necessária.
- Ao recuperar a conexão, um toast confirma que as consultas podem ser retomadas.
- Nenhuma alteração patrimonial é enfileirada ou gravada localmente para sincronização posterior.

### Atualizações

- Uma nova versão instalada pelo service worker aguarda decisão do usuário.
- O app exibe toast persistente com a ação `ATUALIZAR AGORA`.
- Somente após essa ação o novo worker assume o controle e a página é recarregada.
- Caches `cmapp-*` de versões anteriores são removidos na ativação.

## Decisão sobre push notifications

Push notifications não foram ativadas nesta sprint. A implementação exige tokens por dispositivo, consentimento, regras, limpeza dos tokens e emissão por backend confiável. Esse trabalho permanece associado à Sprint 1.3.

Eventos candidatos já identificados:

- nova transferência aguardando aprovação;
- transferência aprovada ou rejeitada;
- patrimônio não cadastrado encontrado em campo;
- abertura, encerramento ou alteração de um ciclo de inventário;
- comunicação administrativa relevante.

O aplicativo não solicita permissão de notificação nesta versão.

## Firebase e publicação

- Não há alteração nas regras do Firestore ou do Storage.
- Não há nova coleção, documento, índice ou Cloud Function.
- Não é necessário habilitar Firebase Cloud Messaging.
- A hospedagem deve usar HTTPS e publicar `manifest.webmanifest`, `service-worker.js`, `offline.html`, `js/pwa.js` e os novos ícones.
- O arquivo `service-worker.js` não deve receber cache imutável de longa duração no servidor.

## Arquivos principais

- `manifest.webmanifest`: identidade, escopo, modo de exibição e ícones.
- `service-worker.js`: cache do shell e ciclo de atualização.
- `offline.html`: orientação quando o shell não puder ser carregado.
- `js/pwa.js`: instalação, conectividade e atualização.
- `js/ui/feedback.js`: ação opcional dentro de toast.
- `assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` e `apple-touch-icon.png`.
- `tests/pwa.test.mjs`: regressões específicas da Sprint 1.2.

## Testes automatizados

Executar na pasta pública:

```bash
node --test tests/*.test.mjs
```

A suíte possui 44 testes e cobre câmera, estrutura, navegação, feedback, perfil, credenciais e PWA.

## Roteiro de teste manual

1. Publicar todos os arquivos em HTTPS.
2. No Android, remover o atalho ou instalação anterior do CM APP antes do primeiro teste.
3. Abrir o app no Chrome, interagir com a página e verificar a opção de instalação no navegador ou em `Meu perfil`.
4. Instalar e confirmar nome `CM APP`, ícone próprio e abertura sem a barra de endereço.
5. Abrir `Meu perfil` no app instalado e confirmar a mensagem de que ele está em modo de aplicativo.
6. Testar câmera, OCR, leitura manual, botão voltar, sidebar e menu do perfil no modo instalado.
7. Com uma sessão autenticada, desligar a internet e confirmar o banner de indisponibilidade.
8. Reabrir o app offline e confirmar que o shell pode abrir, sem permitir consultas ou alterações no servidor.
9. Restaurar a conexão e confirmar o toast de conexão restabelecida.
10. Abrir em uma aba comum e confirmar que a aplicação continua funcionando normalmente.
11. Testar também em desktop; a instalação deve ser opcional e a responsividade deve ser preservada.
12. Em uma publicação futura, confirmar que uma nova versão exibe `ATUALIZAR AGORA` antes de recarregar.

## Próximas sprints

- Sprint 1.3: operações administrativas sensíveis em backend confiável e arquitetura de push notifications.
- Sprint 1.4: observabilidade com fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.
