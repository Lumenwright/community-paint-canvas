import pixels
import json

FILE_PATH = 'canvas.json'
NUM_COL = 10
NUM_ROW = 10

def write_to_json(canvas):
    with open(FILE_PATH, 'w', newline='') as f:
        json.dump(canvas, f)

#generate new canvas (green so it can be chromakeyed)
def reset_canvas():
    canvas = {}
    canvas_list = []
    for j in range(NUM_COL):
        row_dict = {}
        row_list = []
        for i in range(NUM_ROW):
            color = {pixels.X_NAME:j, pixels.Y_NAME:i, pixels.RED_NAME:0.0, pixels.GREEN_NAME:1.0, pixels.BLUE_NAME:0.0}
            px={}
            px[pixels.PX_NAME] = color
            row_list.append(px)
        row_dict[pixels.ROW_NAME] = row_list
        canvas_list.append(row_dict)
    canvas[pixels.CANVAS_NAME] = canvas_list
    write_to_json(canvas)
    return canvas