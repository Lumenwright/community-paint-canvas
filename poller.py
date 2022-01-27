import threading

import threading

def start_polling(f, period):
    timer = threading.Timer(period, f)
    timer.start()