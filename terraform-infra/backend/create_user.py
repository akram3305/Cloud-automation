from database import SessionLocal
from models import User

db = SessionLocal()

existing = db.query(User).filter(User.username == "system").first()

if not existing:
    user = User(
        username="system",
        email="system@local.com",     # ✅ REQUIRED FIX
        full_name="System User",      # ✅ good practice
        hashed_pwd="dummy",
        role="admin",
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    print("✅ System User Created, ID:", user.id)
else:
    print("⚠️ System user already exists, ID:", existing.id)

db.close()