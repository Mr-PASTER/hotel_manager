from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import schemas
from database import get_db
from dependencies import get_admin_user

router = APIRouter(prefix="/api/guests", tags=["guests"])


@router.get("/", response_model=list[schemas.GuestOut])
def get_guests(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return db.query(models.Guest).all()


@router.get("/{guest_id}", response_model=schemas.GuestOut)
def get_guest(guest_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")
    return guest


@router.post("/", response_model=schemas.GuestOut, status_code=201)
def create_guest(
    data: schemas.GuestCreate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    guest = models.Guest(**data.model_dump())
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


@router.put("/{guest_id}", response_model=schemas.GuestOut)
def update_guest(
    guest_id: int,
    data: schemas.GuestUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(guest, key, value)
    db.commit()
    db.refresh(guest)
    return guest


@router.delete("/{guest_id}", status_code=204)
def delete_guest(
    guest_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")
    db.delete(guest)
    db.commit()
