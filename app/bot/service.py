import logging
import asyncio
from aiogram import Bot, Dispatcher
from app.bot.config import BOT_TOKEN
from app.bot.handlers import router
from app.bot.keyboards import get_task_done_keyboard
from app.models import User
from app.database import SessionLocal
from sqlalchemy import select

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self, token: str = BOT_TOKEN):
        if not token:
            logger.warning("BOT_TOKEN not provided. Service disabled.")
            self.bot = None
            self.dp = None
        else:
            self.bot = Bot(token=token)
            self.dp = Dispatcher()
            self.dp.include_router(router)

    async def start_polling(self):
        """Запуск поллинга (для использования в фоновой задаче)"""
        if self.bot and self.dp:
            logger.info("Starting Telegram Bot Polling...")
            await self.bot.delete_webhook(drop_pending_updates=True)
            await self.dp.start_polling(self.bot)

    async def _resolve_chat_id(self, identifier: str | int | User) -> int | None:
        """
        Пытается найти chat_id по telegram_id, телефону, username или объекту User.
        """
        if isinstance(identifier, User):
            if identifier.telegram_id:
                return int(identifier.telegram_id)
            # Если в объекте нет tg_id, пробуем найти по телефону/username? 
            # Обычно User уже из БД, так что если нет, то нет.
            return None

        # Если передали int
        if isinstance(identifier, int):
            return identifier

        # Если строка
        if isinstance(identifier, str):
            identifier = identifier.strip()
            # Если это ID (цифры)
            if identifier.isdigit():
                return int(identifier)
            
            # Если начинается с @, убираем
            search_val = identifier
            if search_val.startswith("@"):
                search_val = search_val[1:]

            # Пробуем найти в БД
            async with SessionLocal() as session:
                # 1. Поиск по telegram_id (если вдруг записан как строка в user.telegram_id)
                stmt = select(User).where(User.telegram_id == search_val)
                res = await session.execute(stmt)
                user = res.scalars().first()
                if user:
                    return int(user.telegram_id)

                # 2. Поиск по username
                stmt = select(User).where(User.username == search_val)
                res = await session.execute(stmt)
                user = res.scalars().first()
                if user and user.telegram_id:
                    return int(user.telegram_id)
                
                # 3. Поиск по телефону
                stmt = select(User).where(User.phone == identifier) # тут используем оригинал
                res = await session.execute(stmt)
                user = res.scalars().first()
                if user and user.telegram_id:
                    return int(user.telegram_id)

                # 4. Поиск по полному имени (full_name)
                stmt = select(User).where(User.full_name == identifier)
                res = await session.execute(stmt)
                user = res.scalars().first()
                if user and user.telegram_id:
                    return int(user.telegram_id)
        
        return None

    async def notify_assignment(self, user_identifier: str | int | User, room_number: str, room_id: int, task_type: str):
        """
        Уведомление о назначении на задачу.
        identifier: User object, telegram_id, phone, or username.
        task_type: 'cleaning' (Уборка) or 'repair' (Ремонт)
        """
        if not self.bot:
            return

        chat_id = await self._resolve_chat_id(user_identifier)
        if not chat_id:
            logger.warning(f"Could not resolve chat_id for {user_identifier}")
            return

        task_name = "УБОРКА" if task_type == "cleaning" else "РЕМОНТ"
        text = (
            f"📋 <b>НОВАЯ ЗАДАЧА: {task_name}</b>\n\n"
            f"🏨 Номер: <b>{room_number}</b>\n"
            f"Пожалуйста, приступайте к выполнению.\n"
            f"Нажмите кнопку ниже, когда закончите."
        )

        try:
            await self.bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode="HTML",
                reply_markup=get_task_done_keyboard(room_id, task_type)
            )
            logger.info(f"Notification sent to {chat_id} for room {room_number}")
        except Exception as e:
            logger.error(f"Failed to send notification to {chat_id}: {e}")

    async def notify_removal(self, user_identifier: str | int | User, room_number: str):
        """
        Уведомление о снятии с задачи.
        """
        if not self.bot:
            return

        chat_id = await self._resolve_chat_id(user_identifier)
        if not chat_id:
            return

        text = (
            f"❌ <b>ЗАДАЧА ОТМЕНЕНА</b>\n\n"
            f"Вы сняты с задачи в номере <b>{room_number}</b>."
        )

        try:
            await self.bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Failed to send removal notification: {e}")

    async def notify_admins(self, text: str):
        """
        Отправляет уведомление всем администраторам.
        """
        if not self.bot:
            return

        async with SessionLocal() as session:
            # Ищем всех администраторов с telegram_id
            stmt = select(User).where(User.role == "admin", User.telegram_id.is_not(None))
            res = await session.execute(stmt)
            admins = res.scalars().all()
            
            for admin in admins:
                if admin.telegram_id:
                    try:
                        await self.bot.send_message(
                            chat_id=int(admin.telegram_id),
                            text=text,
                            parse_mode="HTML"
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify admin {admin.username}: {e}")

# Глобальный экземпляр
bot_service = TelegramService()
