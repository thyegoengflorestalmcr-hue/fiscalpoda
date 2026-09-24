#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-turing-clover-397802}"
MODEL_ID="${TESTLAB_MODEL:-MediumPhone.arm}"
REPO="thyegoengflorestalmcr-hue/fiscalpoda"
TAG="arbor-intel-testlab-production-baseline"
BASE="https://github.com/${REPO}/releases/download/${TAG}"
WORK="${HOME}/arbor-intel-testlab-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WORK"
cd "$WORK"

printf '\n=== ARBOR INTEL · Firebase Test Lab ===\n'
printf 'Project: %s\nModel: %s\nWorkdir: %s\n\n' "$PROJECT_ID" "$MODEL_ID" "$WORK"

command -v gcloud >/dev/null || { echo 'ERRO: gcloud não está disponível. Execute no Google Cloud Shell normal.'; exit 2; }
gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q . || { echo 'ERRO: Cloud Shell sem conta Google autenticada.'; exit 2; }

gcloud config set project "$PROJECT_ID" >/dev/null
printf 'Conta Google ativa: '; gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1

printf '\n[1/7] Habilitando APIs necessárias...\n'
gcloud services enable \
  serviceusage.googleapis.com \
  firebase.googleapis.com \
  testing.googleapis.com \
  toolresults.googleapis.com \
  --project="$PROJECT_ID" --quiet

printf '\n[2/7] Verificando se o projeto já é Firebase...\n'
TOKEN="$(gcloud auth print-access-token)"
HTTP="$(curl -sS -o firebase-project.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}")"

if [ "$HTTP" != "200" ]; then
  echo "Projeto ainda não aparece como Firebase (HTTP ${HTTP}). Tentando adicionar Firebase automaticamente..."
  ADD_JSON="$(curl -sS -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}:addFirebase")"
  printf '%s\n' "$ADD_JSON" > add-firebase.json

  OP_NAME="$(python3 - <<'PY'
import json
try:
    j=json.load(open('add-firebase.json'))
    print(j.get('name',''))
except Exception:
    print('')
PY
)"

  if [ -z "$OP_NAME" ]; then
    echo 'Não foi possível adicionar Firebase automaticamente.'
    echo 'Resposta do Google:'
    cat add-firebase.json
    echo
    echo "Se a resposta mencionar termos do Firebase, abra uma vez: https://console.firebase.google.com/project/${PROJECT_ID}/overview"
    echo 'Aceite os Termos do Firebase e execute este mesmo comando novamente.'
    exit 3
  fi

  echo "Provisionamento Firebase: ${OP_NAME}"
  for i in $(seq 1 30); do
    TOKEN="$(gcloud auth print-access-token)"
    curl -sS -H "Authorization: Bearer ${TOKEN}" \
      "https://firebase.googleapis.com/v1beta1/${OP_NAME}" > firebase-operation.json
    DONE="$(python3 - <<'PY'
import json
j=json.load(open('firebase-operation.json'))
print(str(j.get('done',False)).lower())
PY
)"
    if [ "$DONE" = "true" ]; then
      if python3 - <<'PY'
import json,sys
j=json.load(open('firebase-operation.json'))
sys.exit(1 if j.get('error') else 0)
PY
      then
        echo 'Firebase adicionado com sucesso.'
        break
      else
        echo 'Falha no provisionamento Firebase:'
        cat firebase-operation.json
        exit 4
      fi
    fi
    sleep 4
  done
fi

printf '\n[3/7] Baixando APKs validados...\n'
curl -fL --retry 3 -o arbor-intel-testlab-app.apk "${BASE}/arbor-intel-testlab-app.apk"
curl -fL --retry 3 -o arbor-intel-testlab-androidTest.apk "${BASE}/arbor-intel-testlab-androidTest.apk"
curl -fL --retry 3 -o apk-sha256.txt "${BASE}/apk-sha256.txt"
sha256sum -c apk-sha256.txt

printf '\n[4/7] Validando modelo Test Lab...\n'
if ! gcloud firebase test android models describe "$MODEL_ID" --project="$PROJECT_ID" --format='yaml(id,name,supportedVersionIds,tags)' > model.yaml; then
  echo "Modelo ${MODEL_ID} indisponível. Modelos atuais:"
  gcloud firebase test android models list --project="$PROJECT_ID" --limit=30
  exit 5
fi
cat model.yaml

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

printf '\n[5/7] Executando Robo Test exploratório...\n'
set +e
gcloud firebase test android run \
  --project="$PROJECT_ID" \
  --type=robo \
  --app=arbor-intel-testlab-app.apk \
  --device="model=${MODEL_ID},locale=pt_BR,orientation=portrait" \
  --device="model=${MODEL_ID},locale=en,orientation=landscape" \
  --timeout=8m \
  --record-video \
  --num-flaky-test-attempts=1 \
  --results-history-name='ARBOR Intel · Produção · Robo' \
  --client-details="matrixLabel=ARBOR Intel Production Robo ${STAMP}" \
  2>&1 | tee robo-testlab.log
ROBO_EXIT=${PIPESTATUS[0]}

printf '\n[6/7] Executando Espresso-Web funcional...\n'
gcloud firebase test android run \
  --project="$PROJECT_ID" \
  --type=instrumentation \
  --app=arbor-intel-testlab-app.apk \
  --test=arbor-intel-testlab-androidTest.apk \
  --device="model=${MODEL_ID},locale=pt_BR,orientation=portrait" \
  --device="model=${MODEL_ID},locale=en,orientation=landscape" \
  --timeout=12m \
  --record-video \
  --num-flaky-test-attempts=1 \
  --use-orchestrator \
  --results-history-name='ARBOR Intel · Produção · Espresso' \
  --client-details="matrixLabel=ARBOR Intel Production Espresso ${STAMP}" \
  2>&1 | tee espresso-testlab.log
ESPRESSO_EXIT=${PIPESTATUS[0]}
set -e

printf '\n[7/7] Resumo\n'
printf 'Robo exit: %s\nEspresso exit: %s\n' "$ROBO_EXIT" "$ESPRESSO_EXIT" | tee testlab-summary.txt
printf '\nURLs/matrizes encontradas:\n' | tee -a testlab-summary.txt
grep -Eo 'https?://[^ ]+|matrix[^ ]*' robo-testlab.log espresso-testlab.log | tail -30 | tee -a testlab-summary.txt || true
printf '\nArquivos de log: %s\n' "$WORK"

if [ "$ROBO_EXIT" -ne 0 ] || [ "$ESPRESSO_EXIT" -ne 0 ]; then
  echo 'A matriz encontrou falha(s) ou erro de infraestrutura. Isso é um resultado útil de QA; envie o conteúdo de testlab-summary.txt para análise.'
  exit 10
fi

echo 'Robo e Espresso concluíram sem falha reportada pelo gcloud.'
