"""
Script para diagnosticar associação entre professor, cursos e estágios.

Como usar:
1. pip install firebase-admin python-dotenv
2. Garantir que o ficheiro .env está na root do projeto.
3. Editar UID_PROFESSOR e SCHOOL_ID abaixo.
4. Executar: python scripts/check-estagios.py
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

# CONFIGURAÇÃO — ALTERA ESTES VALORES
UID_PROFESSOR = "uKIlZKkuB2SgJIK17wDqLOwgSLp2"
SCHOOL_ID = "esrp"

# Ler variáveis pequenas do .env
project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("FIREBASE_ADMIN_PROJECT_ID")
client_email = os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL")
private_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY")

if not project_id or not client_email or not private_key:
    raise RuntimeError("Variáveis FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL ou FIREBASE_ADMIN_PRIVATE_KEY estão em falta no .env")

# Corrigir \n na private key
private_key = private_key.replace("\\n", "\n")

service_account_info = {
    "type": "service_account",
    "project_id": project_id,
    "private_key_id": "dummy",  # não é necessário
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

print("\n=== CURSOS DA ESCOLA ===")
courses = db.collection("courses").where("schoolId", "==", SCHOOL_ID).stream()
course_map = {}

for c in courses:
    data = c.to_dict()
    course_map[c.id] = data
    print(f"- {c.id}:")
    print(f"  director: {data.get('courseDirectorId')}")
    print(f"  teacherIds: {data.get('teacherIds')}")
    print(f"  supportingTeacherIds: {data.get('supportingTeacherIds')}")
    print()

print("\n=== ESTÁGIOS DA ESCOLA ===")
estagios = db.collection("estagios").where("schoolId", "==", SCHOOL_ID).stream()

for e in estagios:
    data = e.to_dict()
    print(f"- Estágio {e.id}:")
    print(f"  alunoCourseId: {data.get('alunoCourseId')}")
    print(f"  courseId: {data.get('courseId')}")
    print(f"  professorId: {data.get('professorId')}")
    print(f"  tutorId: {data.get('tutorId')}")
    print()

print("\n=== VERIFICAÇÃO DE ASSOCIAÇÃO ===")

for e in db.collection("estagios").where("schoolId", "==", SCHOOL_ID).stream():
    est = e.to_dict()
    course_id = est.get("alunoCourseId") or est.get("courseId")
    course = course_map.get(course_id)

    print(f"\nEstágio {e.id}:")
    print(f"  → courseId: {course_id}")

    if not course:
        print("  ❌ Curso não encontrado")
        continue

    print(f"  → Diretor: {course.get('courseDirectorId')}")
    print(f"  → teacherIds: {course.get('teacherIds')}")
    print(f"  → supportingTeacherIds: {course.get('supportingTeacherIds')}")

    if course.get("courseDirectorId") == UID_PROFESSOR:
        print("  ✔ Professor é DIRETOR deste curso")

    if UID_PROFESSOR in (course.get("teacherIds") or []):
        print("  ✔ Professor está em teacherIds")

    if UID_PROFESSOR in (course.get("supportingTeacherIds") or []):
        print("  ✔ Professor está em supportingTeacherIds")

    if est.get("professorId") == UID_PROFESSOR:
        print("  ✔ Professor é ORIENTADOR do estágio")

    if est.get("tutorId") == UID_PROFESSOR:
        print("  ✔ Professor é TUTOR do estágio")
