# Sprint 0.6 — validação patrimonial por perfil

## Objetivo

Alinhar o fluxo de movimentação patrimonial às responsabilidades dos perfis e permitir que qualquer usuário renove manualmente os dados permitidos da Relação.

## Entregas

- Administrador e Gestor passam a efetivar diretamente uma mudança de localização, sem enviar o patrimônio à Fila.
- Conferente continua solicitando aprovação quando informa uma localização diferente da atual.
- Um patrimônio já pendente fica bloqueado para nova gravação pelo Conferente até a validação de Gestor/Admin.
- A comparação de mudança usa `localizacaoAtual` como referência; `divisaoOrigem` permanece histórica.
- Toda conferência ou movimentação acrescenta um registro ao histórico, incluindo o tipo da ação.
- A regra de movimentação foi isolada em `js/core/movimentacao.js` para permitir validação independente da interface.
- A interface informa previamente se a mudança será validada imediatamente ou enviada à aprovação.
- O botão da tela de Leitura muda para `Atualizar Patrimônio` nos perfis validadores.
- `Atualizar dados da relação` fica disponível para todos os perfis.
- Exportações CSV continuam disponíveis somente para Administrador e Gestor.
- A paginação de 50 documentos e o filtro local sobre a base completa permanecem inalterados.

## Decisões consolidadas

- Não será implementado botão “Carregar tudo”.
- A futura sprint de UX seguirá abordagem mobile-first e também aprimorará o uso em desktop.
- O futuro PWA será configurado para execução instalada em modo `standalone`, sem a barra de navegação do navegador.
- A normalização de Gestores com `divisoesAtribuidas: []` foi concluída.
- Foto de perfil, alteração da própria senha, reset por e-mail pelo Administrador e personalização dos e-mails do Firebase permanecem previstos para a sprint de perfil.

## Regras do Firestore

Não foi necessário ampliar permissões de Administrador ou Gestor. As regras já permitem que esses perfis atualizem os campos operacionais autorizados. A regra do Conferente foi endurecida para impedir nova gravação sobre um patrimônio que já esteja com transferência pendente.

## Testes manuais recomendados

1. Entrar como Conferente e abrir a Relação.
2. Confirmar que `Atualizar dados da relação` está visível e que os botões CSV permanecem ocultos.
3. Como Conferente, registrar um patrimônio sem mudar sua localização; confirmar conclusão normal.
4. Como Conferente, selecionar localização diferente da atual; confirmar aviso amarelo e criação de pendência na Fila.
5. Como Conferente, reabrir o patrimônio pendente; confirmar botão desabilitado e bloqueio de nova gravação.
6. Entrar como Gestor e repetir a mudança; confirmar aviso azul, atualização imediata de `localizacaoAtual` e ausência de nova pendência.
7. Repetir o teste como Administrador.
8. Confirmar que `divisaoOrigem` não foi alterada em nenhuma movimentação.
9. Confirmar no documento que o histórico recebeu uma entrada com `acao: transferencia_solicitada` ou `acao: transferencia_validada`.
10. Abrir a Fila e confirmar que somente a solicitação criada pelo Conferente aparece.
11. Voltar à Relação, usar Atualizar e confirmar os dados mais recentes.

## Arquivos públicos

- `index.html`
- `app.js`
- `app.css`
- `assets/favicon.svg`
- `js/config/firebase.js`
- `js/core/firestore-metrics.js`
- `js/core/movimentacao.js`
- `js/services/divisoes.service.js`

## Arquivos internos

- `firestore.rules`
- `FIRESTORE-SETUP.md`
- `DECISOES-DE-PROJETO.md`
- `SPRINT-0.6.md`

Os arquivos internos não fazem parte do pacote destinado ao repositório público.
