# App nativo (iOS + Android) — Marido pra Quê?

Este projeto tem um app nativo gerado com **Capacitor**. A estratégia é um
**shell nativo que carrega o site publicado** (`https://maridopraque.lovable.app`)
mais recursos nativos (splash, status bar, deep links, câmera, push). Assim
reaproveitamos 100% do app web — não há um segundo código de tela para manter.

```
Web (React/TanStack)  ──build/deploy──▶  maridopraque.lovable.app
                                              ▲
                                              │ server.url (carrega o site)
                       Capacitor shell  ──────┘
                       (iOS + Android)  + plugins nativos
```

## O que já está pronto no repositório

- `capacitor.config.ts` — appId `com.maridopraque.app`, aponta para a produção
  (ou `CAP_SERVER_URL` para homologação).
- `android/` — projeto Android (Gradle).
- `ios/` — projeto iOS (Xcode, usa Swift Package Manager — não precisa de CocoaPods).
- `mobile/www/index.html` — tela de fallback offline empacotada.
- `src/lib/native.ts` — ponte nativa (splash, status bar, botão voltar do
  Android, deep links e a função de push nativo, ainda desligada — ver Fase B).
- Plugins instalados: `app`, `splash-screen`, `status-bar`, `camera`,
  `preferences`, `push-notifications`.
- iOS `Info.plist` já com as descrições de uso de câmera/galeria e
  `remote-notification`.

> Importante: como o app carrega o site publicado, **qualquer mudança no app web
> aparece no app nativo automaticamente** após o deploy — sem precisar republicar
> nas lojas. Só é preciso republicar nas lojas quando muda algo **nativo**
> (ícone, plugins, permissões, versão).

## Pré-requisitos

| Plataforma | Precisa de |
|-----------|-----------|
| Android   | [Android Studio](https://developer.android.com/studio) (Windows/Mac/Linux) + conta no Google Play Console (US$ 25, uma vez) |
| iOS       | Um **Mac** com Xcode **ou** um serviço de build em nuvem (Codemagic, etc.) + Apple Developer Program (US$ 99/ano) |

Em qualquer máquina de desenvolvimento, depois de clonar o repo:

```bash
npm install
npx cap sync        # copia config + plugins para android/ e ios/
```

## Fase A — Rodar localmente (já dá para testar)

### Android
```bash
npm run cap:android      # abre o projeto no Android Studio
```
No Android Studio: selecione um emulador ou device e clique em ▶ Run. O app
abre carregando o site de produção.

### iOS (precisa de Mac)
```bash
npm run cap:ios          # abre o projeto no Xcode
```
No Xcode: selecione um simulador/iPhone, ajuste o *Signing Team* (sua conta
Apple) e clique em ▶ Run.

## Fase B — Branding e push nativo

### 1. Ícone e splash
Coloque um ícone quadrado **1024×1024** e uma splash **2732×2732** em `assets/`:
```
assets/icon.png      (1024×1024)
assets/splash.png    (2732×2732, logo centralizado em fundo #FF6B35)
```
Depois gere os tamanhos para as duas plataformas:
```bash
npx @capacitor/assets generate --iconBackgroundColor "#FF6B35" --splashBackgroundColor "#FF6B35"
npx cap sync
```

### 2. Push nativo (APNs no iOS / FCM no Android)
O push da web (VAPID / service worker) **não funciona** dentro do app nativo.
Para push no app é preciso:

1. **Firebase (Android)**: criar projeto no Firebase, baixar `google-services.json`
   e colocar em `android/app/`. O plugin `@capacitor/push-notifications` usa FCM.
2. **APNs (iOS)**: no Apple Developer, criar uma *APNs Auth Key* (.p8) e habilitar
   *Push Notifications* no capability do app no Xcode.
3. **Tabela de tokens**: criar `device_push_tokens (user_id, token, platform, created_at)`
   no Supabase. A função `registrarPushNativo(userId)` em `src/lib/native.ts` já
   salva o token nessa tabela — basta chamá-la após o login (ex.: junto do banner
   de notificações) e criar a tabela.
4. **Envio**: estender a edge function de envio para mandar via FCM/APNs para os
   tokens nativos (hoje `send-push` só faz Web Push). O FCM v1 e o APNs aceitam
   HTTP; dá para reaproveitar o mesmo gatilho de notificação.

> Enquanto o push nativo não está configurado, `registrarPushNativo` **não é
> chamado** — para não pedir permissão de notificação sem ter entrega por trás.

### 3. Deep links / Universal Links (opcional, recomendado)
`src/lib/native.ts` já trata `appUrlOpen`. Para abrir links `maridopraque.com`
direto no app, configure *Associated Domains* (iOS) e *App Links* (Android) com
o domínio. Sem isso, os deep links por esquema custom ainda funcionam.

## Fase C — Publicar nas lojas

### Android (Google Play)
```bash
# No Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle (.aab)
# Crie/Use uma keystore de release e GUARDE-A (sem ela não dá para atualizar o app).
```
Suba o `.aab` no [Play Console](https://play.google.com/console) → crie o app,
preencha a ficha (descrição, prints, política de privacidade) → trilha de
produção → revisão.

### iOS (App Store)
No Xcode (Mac): *Product > Archive* → *Distribute App* → App Store Connect.
Em [App Store Connect](https://appstoreconnect.apple.com): crie o app, ficha,
prints, e envie para revisão.

> **Atenção à revisão da Apple (regra 4.2 — Minimum Functionality):** apps que são
> "só um site embrulhado" podem ser rejeitados. Os recursos nativos (push nativo,
> câmera nas fotos do serviço, splash/ícone próprios, deep links) ajudam a passar.
> Vale priorizar o push nativo (Fase B) antes do envio à App Store.

## Versionamento

- **Android**: `versionCode`/`versionName` em `android/app/build.gradle`.
- **iOS**: `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` no target do Xcode.

Suba esses números a cada publicação nativa.

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run cap:sync` | Copia config + plugins para os projetos nativos |
| `npm run cap:android` | Sync + abre no Android Studio |
| `npm run cap:ios` | Sync + abre no Xcode (Mac) |
| `CAP_SERVER_URL=https://preview--maridopraque.lovable.app npx cap sync` | Aponta o app para o preview (homologação) |
