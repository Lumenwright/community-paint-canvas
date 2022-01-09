import threading

import threading
INTERVAL = 5.0 #seconds

def start_polling(f):
    timer = threading.Timer(INTERVAL, f)
    timer.start()

if(__name__ == "__main__"):
    def f():
        print("time")
    start_polling(f)