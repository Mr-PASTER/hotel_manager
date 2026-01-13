from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from .callbacks import TaskCallback

def get_task_done_keyboard(room_id: int, task_type: str) -> InlineKeyboardMarkup:
    """
    Создает клавиатуру с кнопкой "Работа выполнена".
    """
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="✅ Работа выполнена",
                callback_data=TaskCallback(action="done", room_id=room_id, task_type=task_type).pack()
            )
        ]
    ])
