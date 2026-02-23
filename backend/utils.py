from sqlalchemy.orm import Session
import models


def get_config(db: Session, key: str) -> str | None:
    config = db.query(models.AppConfig).filter(models.AppConfig.key == key).first()
    return config.value if config else None
