"""Promotes an existing registered user to admin. There's no self-service "become admin" flow
by design -- run this once from the server/ops side to bootstrap the first admin account.

Usage: python -m app.promote_admin someone@example.com
"""
import sys

from app.core.db import SessionLocal
from app.db_models.user import User, UserRole


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.promote_admin <email>")
        sys.exit(1)

    email = sys.argv[1]
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"No user with email '{email}' -- register the account first, then promote it.")
            sys.exit(1)
        user.role = UserRole.admin
        db.commit()
        print(f"Promoted {user.email} (id={user.id}) to admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
