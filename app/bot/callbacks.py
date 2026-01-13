from aiogram.filters.callback_data import CallbackData

class TaskCallback(CallbackData, prefix="task"):
    action: str  # "done"
    room_id: int
    task_type: str # "cleaning" or "repair"
