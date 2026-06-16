<p align="center">
  <img src="icons/icon128.png" alt="Twitch Ads Blocker" width="80" />
</p>

<h1 align="center">Twitch Ads Blocker</h1>

<p align="center">
  Extensão para Chrome e Firefox (Manifest V3) que bloqueia propagandas na Twitch<br/>
  usando o motor <strong>VAFT</strong> (Video Ad-Free Twitch) com melhorias de performance e qualidade.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blueviolet" alt="MV3" />
  <img src="https://img.shields.io/badge/engine-VAFT%20v37-9147ff" alt="VAFT v37" />
  <img src="https://img.shields.io/badge/chrome-%E2%9C%93-brightgreen" alt="Chrome" />
  <img src="https://img.shields.io/badge/firefox-%E2%9C%93-brightgreen" alt="Firefox" />
</p>

---

## Como funciona

A Twitch entrega streams ao vivo via **HLS** (HTTP Live Streaming). O player pede uma playlist M3U8 a cada poucos segundos contendo URLs de segmentos de video. Quando rola propaganda, a Twitch injeta segmentos de ad direto nessa playlist, marcados com a tag `stitched`.

A extensão intercepta esse fluxo em múltiplas camadas:

### 1. Interceptação do Worker

A Twitch roda o player dentro de um Web Worker. A extensão substitui o constructor `Worker` antes de qualquer script da Twitch carregar, injetando o motor VAFT dentro do blob do worker. Isso permite interceptar todos os requests de playlist e segmentos de dentro do thread de media.

### 2. Backup Stream (bloqueio principal)

Quando ads aparecem na playlist, a extensão pede **access tokens alternativos** usando player types diferentes (`embed`, `popout`). A Twitch trata esses tipos como sessões separadas e frequentemente retorna um stream limpo, sem propagandas, em **resolução original**.

### 3. Pre-warming de Backup

Os streams alternativos são pré-carregados em background assim que o stream principal inicia, e renovados a cada 90 segundos. Quando um ad aparece, a troca pro stream limpo é instantanea porque os tokens e playlists ja estão prontos no cache.

### 4. Looping de Segmento Real

Se nenhum stream alternativo estiver disponível sem ads, a extensão faz **ad stripping** — remove os segmentos de propaganda da playlist e os substitui pelo último segmento real de video. O viewer vê a última cena "congelada" em resolução total, em vez de uma tela preta.

### 5. Watchdog Recovery

Um monitor independente observa o `<video>` da página a cada 2 segundos. Se o `currentTime` parar de progredir por 15 segundos, tenta recuperar com pause/play. Se travar de novo, recarrega a tab. Reseta automaticamente ao trocar de canal.

### 6. Detecção de Conflito

Ao carregar uma tab da Twitch, a extensão verifica se outro adblocker (userscript, uBlock filter, outra extensão VAFT) já está ativo, evitando conflitos que quebram o player.

---

## Instalação

### Chrome / Edge / Brave

1. Baixe ou clone este repositório
2. Acesse `chrome://extensions`
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação**
5. Selecione a pasta do projeto

### Firefox

1. Baixe ou clone este repositório
2. Acesse `about:debugging#/runtime/this-firefox`
3. Clique em **Carregar extensão temporária**
4. Selecione o arquivo `manifest.json` dentro da pasta do projeto

---

## Estrutura do Projeto

```
├── manifest.json                 # Manifesto MV3 da extensão
├── inject.js                     # Content script — injeta o VAFT na página
├── watchdog.js                   # Content script — monitora playback e recupera travamentos
├── popup.html                    # Interface do popup
├── popup.css                     # Estilos do popup (dark theme estilo Twitch)
├── popup.js                      # Lógica do popup com atualizações em tempo real
├── icons/                        # Ícones da extensão (16, 48, 128px)
└── injected/
    ├── vaft.js                   # Motor VAFT — intercepta Worker, fetch, M3U8
    ├── conflict-detector.js      # Detecta outros adblockers ativos
    └── upstream.txt              # Metadados da versão upstream do VAFT
```

---

## Popup

<table>
<tr>
<td width="260">

O popup usa tema escuro inspirado na Twitch com toggle switches customizados.

- **Ad Blocking** — liga/desliga o bloqueio
- **Watchdog Recovery** — liga/desliga a recuperação automática de travamentos
- **Conflict Check** — mostra se há conflito com outros adblockers
- **Reload Twitch Tab** — recarrega a tab ativa da Twitch

Os status atualizam em tempo real via `storage.onChanged`.

</td>
</tr>
</table>

---

## Fluxo Resumido

```
Tab Twitch carrega
  └─ inject.js (document_start)
      ├─ Checa storage: enabled?
      ├─ Roda conflict-detector.js
      └─ Injeta vaft.js na página
          └─ Hooka Worker, fetch, visibilityState, localStorage
              └─ Twitch cria o Worker → VAFT intercepta, injeta código no blob
                  └─ Worker faz fetch de .m3u8
                      ├─ Sem ad? → passa direto
                      └─ Tem ad? → Usa backup stream pre-warmed
                          ├─ Stream limpo? → Usa ele (resolução original)
                          ├─ Ainda tem ad? → Tenta próximo tipo
                          └─ Nenhum limpo? → Strip + loop do último segmento real

  └─ watchdog.js (paralelo)
      └─ Monitora video.currentTime a cada 2s
          ├─ Travou 15s? → pause/play
          └─ Travou de novo? → reload tab
```

---

## Créditos

O motor de ad blocking é baseado no [VAFT (Video Ad-Free Twitch)](https://github.com/pixeltris/TwitchAdSolutions) por **pixeltris**, com as seguintes melhorias:

- Pre-warming de backup streams para troca instantânea
- Looping de último segmento real no lugar de tela preta
- Remoção do player type `autoplay` (360p) do rotation de backup
- Correção de null crash no `getServerTimeFromM3u8`
- Watchdog com reset de recovery por canal
- Popup com dark theme e atualizações em tempo real

---

## Licença

Este projeto é distribuído para uso pessoal e educacional. O motor VAFT é mantido por [pixeltris](https://github.com/pixeltris/TwitchAdSolutions).
