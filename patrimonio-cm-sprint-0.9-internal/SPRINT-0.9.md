# Sprint 0.9 — fluxo assistido de leitura, modularização e testes

## Objetivo

Reduzir o esforço entre apontar a câmera e confirmar uma conferência, mantendo o usuário orientado quando a leitura automática demora e separando a orquestração da câmera do restante da aplicação.

## Entregas

- Ao tocar em `Ligar Câmera`, a tela rola e centraliza o cartão do visor.
- Reinicializações por troca de câmera, orientação ou retorno do segundo plano não forçam nova rolagem.
- Após reconhecer um código de barras, o scanner pausa, congela o quadro e mostra o número sobre uma moldura central.
- O OCR usa o mesmo painel de resultado, identificando claramente a origem da leitura.
- O painel de resultado fica entre o cartão da câmera e o formulário no fluxo mobile e imediatamente antes do formulário na coluna de confirmação do desktop.
- Depois do reconhecimento, a tela rola até esse painel para deixar resultado e formulário como próximo passo.
- A sobreposição é uma confirmação visual da região analisada; não é uma delimitação exata por visão computacional no estilo ALPR.
- Após cinco segundos sem reconhecimento, surge uma ajuda com três ações: usar OCR, digitar a plaqueta ou continuar tentando.
- A ajuda não encerra a tentativa automática. Ao escolher digitação manual, o scanner pausa para evitar concorrência com o preenchimento.
- O fluxo respeita `prefers-reduced-motion`, substituindo rolagem suave por rolagem imediata.
- Resultado e formulário são limpos ao iniciar uma nova tentativa ou selecionar `Ler outra plaqueta`.
- Depois de salvar uma conferência, a câmera retoma a leitura quando ainda estiver disponível.
- A orquestração da câmera foi extraída de `app.js` para `js/controllers/camera.controller.js`.
- Funções determinísticas de tempo, moldura, texto e comportamento de rolagem foram adicionadas a `js/core/camera.js`.
- Foram incorporados testes permanentes em `tests/`, executáveis diretamente pelo Node.js.
- A versão visível foi atualizada para `v1.9.0 • Sprint 0.9`.

## Fluxo adotado

1. O usuário entra em `Leitura` e liga a câmera explicitamente.
2. O app centraliza o visor e inicia a tentativa automática.
3. Se não houver reconhecimento em cinco segundos, o app apresenta alternativas sem desligar a câmera.
4. Ao reconhecer um número por código ou OCR, o app pausa o scanner e preserva o quadro.
5. A tela rola até o resultado com número, origem e imagem de confirmação.
6. O patrimônio é consultado e o usuário confirma localização e observação no formulário.
7. Após salvar, o resultado é limpo e o scanner retoma para o próximo item.

## Compatibilidade e acessibilidade

- A centralização usa `scrollIntoView` e respeita a preferência do sistema por movimento reduzido.
- O painel de resultado recebe foco programático sem provocar uma segunda rolagem.
- Estados de câmera, ajuda, OCR e resultado usam regiões de status para tecnologias assistivas.
- OCR, lanterna, foco e zoom continuam sujeitos às capacidades do navegador e do dispositivo.
- A digitação manual permanece disponível quando câmera ou OCR não puderem ser usados.

## Firestore

Esta sprint não altera consultas, gravações, índices nem regras do Firestore. Não é necessário republicar as regras quando a versão consolidada das sprints anteriores já estiver ativa.

## Testes automatizados executados

- Temporizador de ajuda fixado em cinco segundos.
- Cálculo da área responsiva de leitura.
- Geometria da moldura central da imagem congelada.
- Texto do resultado para código de barras e OCR.
- Rolagem suave e alternativa para movimento reduzido.
- Seleção de câmera preferida, limites de zoom, candidatos de OCR e mensagens de erro.
- Verificação de todos os IDs estáticos consultados por `app.js` e pelo controlador.
- Verificação da ordem do painel de resultado antes do formulário.
- Verificação da separação da orquestração do arquivo principal.
- Verificação sintática de `app.js`, `js/core/camera.js` e `js/controllers/camera.controller.js`.
- Verificação de IDs HTML duplicados.
- Verificação da separação entre pacote público e documentação interna.

Para repetir a suíte pública a partir da pasta do projeto:

```bash
node --test tests/*.test.mjs
```

## Testes manuais recomendados

1. Abrir o app por HTTPS em um celular e entrar em `Leitura`.
2. Confirmar que a tela não se desloca apenas por abrir a aba.
3. Tocar em `Ligar Câmera` e confirmar que o visor é centralizado.
4. Aguardar cinco segundos sem mostrar uma etiqueta e confirmar as três alternativas, mantendo a câmera ativa.
5. Tocar em `Continuar tentando` e confirmar que a ajuda some e a leitura continua.
6. Repetir e tocar em `Digitar plaqueta`; confirmar pausa da câmera, foco no campo e possibilidade de retomar.
7. Ler um código e confirmar pausa, vibração quando suportada, imagem congelada, número sobreposto e rolagem até o resultado.
8. Confirmar que a moldura indica a região central, sem expectativa de contorno exato da etiqueta.
9. Salvar a conferência e confirmar limpeza do resultado e retomada automática da câmera.
10. Usar `Ler outra plaqueta` sem salvar e confirmar formulário e resultado limpos.
11. Usar OCR com uma numeração legível e conferir o mesmo fluxo de resultado.
12. Usar OCR sem candidato legível e confirmar retorno do scanner sem apagar dados já preenchidos.
13. Trocar a câmera e girar o aparelho; confirmar reinicialização sem salto inesperado da página.
14. Ativar a preferência de movimento reduzido no sistema e confirmar ausência de animação de rolagem.
15. Trocar de aba ou sair da conta e confirmar a liberação da câmera.

## Próximas sprints preservadas

- Sprint 1.0: UX/layout mobile-first e desktop responsivo, revisão do menu, campos de pesquisa com botão `X`, Administração e agrupamento da Fila.
- Sprint 1.1: perfil, foto, alteração da própria senha e redefinição de senha pelo Administrador.
- Sprint 1.2: PWA instalável em modo `standalone`.
- Sprint 1.3: segurança e operações administrativas em backend confiável.
- Sprint 1.4: observabilidade e revisão das métricas locais.
- Sprint 2.0: consolidação da refatoração e decisão final sobre o painel de atividade local.
- Não criar botão `Carregar tudo` na Relação.

## Arquivos públicos

- `index.html`
- `app.js`
- `app.css`
- `assets/favicon.svg`
- `js/config/firebase.js`
- `js/controllers/camera.controller.js`
- `js/core/camera.js`
- `js/core/firestore-metrics.js`
- `js/core/movimentacao.js`
- `js/services/divisoes.service.js`
- `tests/camera.test.mjs`
- `tests/estrutura.test.mjs`

## Arquivos internos

- `firestore.rules`
- `FIRESTORE-SETUP.md`
- `DECISOES-DE-PROJETO.md`
- `SPRINT-0.9.md`

Os arquivos internos não fazem parte do pacote destinado ao repositório público.
