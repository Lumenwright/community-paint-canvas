import pixels
import json

FILE_PATH = 'canvas.json'
NUM_COL = 400
NUM_ROW = 400

def write_to_json(canvas):
    with open(FILE_PATH, 'w', newline='') as f:
        json.dump(canvas, f)

#generate new canvas (green so it can be chromakeyed)
#returns the canvas as an array (nested list) NOT the json dict
def reset_canvas():
    canvas_array = []
    canvas_json = {}
    canvas_list = []
    for j in range(NUM_COL):
        row_dict = {}
        row_list = []
        row_array = []
        for i in range(NUM_ROW):
            color = {pixels.X_NAME:j, pixels.Y_NAME:i, pixels.RED_NAME:0.0, pixels.GREEN_NAME:1.0, pixels.BLUE_NAME:0.0}
            row_array.append(color)
            px={}
            px[pixels.PX_NAME] = color
            row_list.append(px)
        row_dict[pixels.ROW_NAME] = row_list
        canvas_list.append(row_dict)
        canvas_array.append(row_array)
    canvas_json[pixels.CANVAS_NAME] = canvas_list
    write_to_json(canvas_json)
    return canvas_array