import threading
from tracemalloc import start
import keys

def wait_for_bool(ref, f, period):
    isTrue = ref.get()
    if isTrue:
        f()
        return True
    else:
        start_polling(lambda:wait_for_bool(ref, f, period), period)
        return False

def start_polling(f, period):
    timer = threading.Timer(period, f)
    timer.start()