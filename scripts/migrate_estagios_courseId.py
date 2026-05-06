"""
Migração segura: preencher courseId/alunoCourseId em estágios órfãos.

Este script:
- Lê todos os estágios da Firestore
- Ignora estágios que já têm courseId/alunoCourseId
- Obtém o aluno (users/<alunoId>)
- Lê o campo courseId do aluno
- Preenche estagio.alunoCourseId com o curso correto
- NÃO sobrescreve nada que já exista
- NÃO apaga dados
- É seguro para correr várias vezes

Como usar:
1. pip install firebase-admin python-dotenv
2. Garantir que .env está na root
3. Executar: python scripts/migrate_estagios_courseId.py
"""

import os
import json
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Carregar .env da root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT_DIR, ".env.local")
load_dotenv(ENV_PATH)

# Ler variáveis pequenas do .env
project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("FIREBASE_ADMIN_PROJECT_ID")
client_email = os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL")
private_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY")

if not project_id or not client_email or not private_key:
    raise RuntimeError("Faltam variáveis FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL ou FIREBASE_ADMIN_PRIVATE_KEY no .env")

private_key = private_key.replace("\\n", "\n")

service_account_info = {
    "type": "service_account",
    "project_id": project_id,
    "private_key_id": "dummy",
    "private_key": private_key,
    "client_email": client_email,
    "client_id": "dummy",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}"
}

cred = credentials.Certificate(service_account_info)
firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n=== MIGRAÇÃO DE ESTÁGIOS ===")

estagios = db.collection("estagios").stream()
total = 0
corrigidos = 0
ignorados = 0
erros = 0

for e in estagios:
    total += 1
    est = e.to_dict()

    aluno_id = est.get("alunoId")
    aluno_course = est.get("alunoCourseId")
    course_id = est.get("courseId")

    # Se já tem curso, ignorar
    if aluno_course or course_id:
        ignorados += 1
        continue

    if not aluno_id:
        print(f"[ERRO] Estágio {e.id} não tem alunoId")
        erros += 1
        continue

    # Buscar aluno
    aluno_ref = db.collection("users").document(aluno_id)
    aluno_snap = aluno_ref.get()

    if not aluno_snap.exists:
        print(f"[ERRO] Aluno {aluno_id} não existe (estágio {e.id})")
        erros += 1
        continue

    aluno_data = aluno_snap.to_dict()
    aluno_course_id = aluno_data.get("courseId")

    if not aluno_course_id:
        print(f"[ERRO] Aluno {aluno_id} não tem courseId (estágio {e.id})")
        erros += 1
        continue

    # Atualizar estágio
    try:
        e.reference.update({
            "alunoCourseId": aluno_course_id
        })
        corrigidos += 1
        print(f"[OK] Estágio {e.id} atualizado → alunoCourseId = {aluno_course_id}")
    except Exception as ex:
        print(f"[ERRO] Falha ao atualizar estágio {e.id}: {ex}")
        erros += 1

print("\n=== RESUMO ===")
print(f"Total de estágios analisados: {total}")
print(f"Corrigidos: {corrigidos}")
print(f"Ignorados (já tinham curso): {ignorados}")
print(f"Erros: {erros}")
