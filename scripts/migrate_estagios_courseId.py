"""
Migração segura: preencher courseId/alunoCourseId em estágios órfãos.

Como usar:
1. pip install firebase-admin python-dotenv
2. Garantir que o ficheiro .env está na root do projeto.
3. Executar em modo dry-run: python scripts/migrate_estagios_courseId.py
4. Executar para aplicar: python scripts/migrate_estagios_courseId.py --apply
"""

import os
import sys

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore


def normalize_text(value):
    return (value or "").strip().casefold()


course_cache = {}


def load_courses_for_school(db, school_id):
    cached = course_cache.get(school_id)
    if cached is not None:
        return cached

    by_id = {}
    by_name = {}

    for course_snap in db.collection("courses").where("schoolId", "==", school_id).stream():
        data = course_snap.to_dict() or {}
        course_name = (data.get("nome") or data.get("name") or course_snap.id or "").strip()
        normalized = normalize_text(course_name)

        by_id[course_snap.id] = course_name
        if normalized:
            if normalized in by_name and by_name[normalized] != course_snap.id:
                by_name[normalized] = None
            else:
                by_name[normalized] = course_snap.id

    course_cache[school_id] = (by_id, by_name)
    return course_cache[school_id]


def resolve_course_id(aluno_data, by_id, by_name):
    raw_course_id = (aluno_data.get("courseId") or "").strip()
    if raw_course_id and raw_course_id in by_id:
        return raw_course_id

    normalized_course_name = normalize_text(aluno_data.get("curso"))
    if normalized_course_name:
        matched = by_name.get(normalized_course_name)
        if matched:
            return matched

    return None


# Carregar .env da root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT_DIR, ".env.local")
load_dotenv(ENV_PATH)

# Ler variáveis pequenas do .env
project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("FIREBASE_ADMIN_PROJECT_ID")
client_email = os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL")
private_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY")

if not project_id or not client_email or not private_key:
    raise RuntimeError(
        "Faltam variáveis FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL ou FIREBASE_ADMIN_PRIVATE_KEY no .env"
    )

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
    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}",
}

cred = credentials.Certificate(service_account_info)
firebase_admin.initialize_app(cred)

db = firestore.client()
apply_changes = "--apply" in sys.argv

print("\n=== MIGRAÇÃO DE ESTÁGIOS ===")
print("Modo:", "APLICAR" if apply_changes else "DRY-RUN")

estagios = db.collection("estagios").stream()
total = 0
corrigidos = 0
ignorados = 0
erros = 0
unresolved = 0

for estagio_snap in estagios:
    total += 1
    estagio_data = estagio_snap.to_dict() or {}

    aluno_id = estagio_data.get("alunoId")
    aluno_course = (estagio_data.get("alunoCourseId") or "").strip()
    course_id = (estagio_data.get("courseId") or "").strip()

    if not aluno_id:
        print(f"[ERRO] Estágio {estagio_snap.id} não tem alunoId")
        erros += 1
        unresolved += 1
        continue

    aluno_snap = db.collection("users").document(aluno_id).get()
    if not aluno_snap.exists:
        print(f"[ERRO] Aluno {aluno_id} não existe (estágio {estagio_snap.id})")
        erros += 1
        unresolved += 1
        continue

    aluno_data = aluno_snap.to_dict() or {}
    school_id = estagio_data.get("schoolId") or aluno_data.get("schoolId")
    if not school_id:
        print(f"[ERRO] Estágio {estagio_snap.id} não tem schoolId e o aluno {aluno_id} também não")
        erros += 1
        unresolved += 1
        continue

    by_id, by_name = load_courses_for_school(db, school_id)

    existing_course_id = None
    if aluno_course and aluno_course in by_id:
        existing_course_id = aluno_course
    elif course_id and course_id in by_id:
        existing_course_id = course_id

    canonical_course_id = existing_course_id or resolve_course_id(aluno_data, by_id, by_name)

    if not canonical_course_id:
        print(f"[ERRO] Não foi possível resolver o curso do aluno {aluno_id} (estágio {estagio_snap.id})")
        erros += 1
        unresolved += 1
        continue

    field_updates = {}
    if aluno_course != canonical_course_id:
        field_updates["alunoCourseId"] = canonical_course_id
    if course_id != canonical_course_id:
        field_updates["courseId"] = canonical_course_id

    if not field_updates:
        ignorados += 1
        continue

    updates = dict(field_updates)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP

    if not apply_changes:
        corrigidos += 1
        print(
            f"[DRY-RUN] Estágio {estagio_snap.id} seria atualizado → "
            f"alunoCourseId = {field_updates.get('alunoCourseId', aluno_course)}, "
            f"courseId = {field_updates.get('courseId', course_id)}"
        )
        continue

    try:
        estagio_snap.reference.update(updates)
        corrigidos += 1
        print(
            f"[OK] Estágio {estagio_snap.id} atualizado → "
            f"alunoCourseId = {field_updates.get('alunoCourseId', aluno_course)}, "
            f"courseId = {field_updates.get('courseId', course_id)}"
        )
    except Exception as ex:
        print(f"[ERRO] Falha ao atualizar estágio {estagio_snap.id}: {ex}")
        erros += 1

print("\n=== RESUMO ===")
print(f"Total de estágios analisados: {total}")
print(f"Corrigidos: {corrigidos}")
print(f"Ignorados (já tinham curso válido): {ignorados}")
print(f"Erros: {erros}")
print(f"Não resolvidos: {unresolved}")
