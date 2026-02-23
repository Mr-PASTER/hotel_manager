from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_admin_user(user: models.Employee = Depends(get_current_user)):
    if user.role != models.EmployeeRole.admin:
        raise HTTPException(status_code=403, detail="Только для администраторов")
    return user


@router.get("/", response_model=list[schemas.AppConfigOut])
def get_settings(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return db.query(models.AppConfig).all()


@router.put("/", response_model=dict)
def update_settings(
    data: schemas.AppConfigUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    updates = data.model_dump(exclude_none=True)
    for key, value in updates.items():
        config = db.query(models.AppConfig).filter(models.AppConfig.key == key).first()
        if config:
            config.value = str(value)
        else:
            config = models.AppConfig(key=key, value=str(value))
            db.add(config)
    db.commit()
    return {"status": "success"}
