from sqlalchemy import Column, Integer, String, Boolean, Enum as SQLAlchemyEnum, DateTime
from datetime import datetime
import enum
from .database import Base

class StatusNomera(str, enum.Enum):
    CHISTO = "Убрана"
    TREBUET_UBORKI = "Требует уборки"
    REMONT = "На ремонте"

class Nomer(Base):
    __tablename__ = "nomera"

    id = Column(Integer, primary_key=True, index=True)
    nomer_komnati = Column(String, unique=True, index=True)
    zanyat = Column(Boolean, default=False)
    fio_zhilca = Column(String, nullable=True)
    
    status = Column(SQLAlchemyEnum(StatusNomera), default=StatusNomera.CHISTO)
    otvetstvenniy = Column(String, nullable=True) # Кто убирает или чинит
    
    kolvo_komnat = Column(Integer, default=1)
    kolvo_krovatey = Column(Integer, default=1)
    
    # Резервация и информация о жильце
    zarezervirovan = Column(Boolean, default=False)
    data_zaezda = Column(String, nullable=True)
    data_viezda = Column(String, nullable=True)
    vremya_zaezda = Column(String, nullable=True)
    vremya_viezda = Column(String, nullable=True)
    
    # Подробные данные гостя/бронировщика
    fio_bron = Column(String, nullable=True) # ФИО бронирующего
    telefon = Column(String, nullable=True) # Телефон
    dop_gosti = Column(Integer, default=0) # Доп. гости
    kommentariy = Column(String, nullable=True) # Комментарий

    @property
    def gotov_k_sdache(self):
        # Комната готова, если она убрана, не на ремонте, не занята и не забронирована
        return (self.status == StatusNomera.CHISTO and 
                not self.zanyat and 
                not self.zarezervirovan)

class BookingStatus(str, enum.Enum):
    BOOKED = "booked"         # Забронировано
    CHECKED_IN = "checked_in" # Заселен
    CANCELLED = "cancelled"   # Отменено
    COMPLETED = "completed"   # Выселен/Завершено

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    nomer_id = Column(Integer, index=True)
    
    # Даты как строки "YYYY-MM-DD"
    start_date = Column(String, index=True)
    end_date = Column(String, index=True)
    
    # Информация о госте
    guest_name = Column(String)
    phone = Column(String, nullable=True)
    source = Column(String, nullable=True) # "От кого"
    comment = Column(String, nullable=True)
    
    status = Column(SQLAlchemyEnum(BookingStatus), default=BookingStatus.BOOKED)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    role = Column(String, default="staff") # admin, staff, cleaner, worker, moderator
    is_active = Column(Boolean, default=True)
    
    # Контактная информация
    phone = Column(String, nullable=True)
    telegram_id = Column(String, nullable=True)
    comment = Column(String, nullable=True)

