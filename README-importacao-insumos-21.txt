IMPORTAÇÃO DOS 21 INSUMOS

Sem dotenv.

1) Coloque importar-insumos-21.mjs e insumos-importacao-21.json na mesma pasta.

2) Instale o SDK, se ainda não tiver:
npm install firebase

3) No PowerShell, defina:
$env:FIREBASE_API_KEY="..."
$env:FIREBASE_AUTH_DOMAIN="..."
$env:FIREBASE_PROJECT_ID="..."
$env:FIREBASE_MESSAGING_SENDER_ID="..."
$env:FIREBASE_APP_ID="..."
$env:FIREBASE_USER_EMAIL="adm@adm.com"
$env:FIREBASE_USER_PASSWORD="sua-senha"

4) Execute:
node importar-insumos-21.mjs

As variáveis ficam somente na sessão atual do PowerShell.
O script não usa .env, dotenv ou .env.local.
