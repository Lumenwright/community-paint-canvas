NUM_COL = 10
NUM_ROW = 10
"""
class Canvas:
    def __init__(self, rows):
        self.canvas = rows

class Px_Row:
    def __init__(self, pixels):
        self.px_row = pixels

class Px:
    def __init__(self, pixel):
        self.px = pixel

class Color:
    def __init__(self, red, green, blue):
        self.r = red
        self.g = green
        self.b = blue

#initialize with white pixels [r,g,b]
canvas = []
for j in range(NUM_COL):
    row = []
    for i in range(NUM_ROW):
        color = Color(255,255,255)
        row.append(color)
    json_row = Px_Row(row)
    canvas.append(json_row)
json_canvas = Canvas(canvas)

with open('canvas.json', 'w', newline='') as f:
    json.dump(json_canvas, f, separators=(',',':'))

"""

def write_to_json(canvas):
    # write to json file with own encoding
    with open('canvas.json', 'w', newline='') as f:
        z = str(0)
        f.write("{\"Canvas\":[{")
        f.write("\"Px_Row\":[{\"Px\":{\"x\":"+z+",\"y\":"+z+",\"r\":"+str(canvas[0][0][0])+",\"g\":"+str(canvas[0][0][1])+",\"b\":"+str(canvas[0][0][2]))
        for j in range(1, len(canvas[0])):
            f.write("} },") 
            f.write("{\"Px\":{\"x\":"+z+",\"y\":"+str(j)+",\"r\":"+str(canvas[0][j][0])+",\"g\":"+str(canvas[0][j][1])+",\"b\":"+str(canvas[0][j][2]))
        for i in range(1,len(canvas)):
            f.write("} }]},")
            f.write("{\"Px_Row\":[{\"Px\":{\"x\":"+z+",\"y\":"+str(j)+",\"r\":"+str(canvas[i][0][0])+",\"g\":"+str(canvas[i][0][1])+",\"b\":"+str(canvas[i][0][2]))
            for k in range(1,len(canvas[i])):
                f.write("} },") 
                f.write("{\"Px\":{\"x\":"+str(i)+",\"y\":"+str(k)+",\"r\":"+str(canvas[i][k][0])+",\"g\":"+str(canvas[i][k][1])+",\"b\":"+str(canvas[i][k][2]))
        f.write("} }")
        f.write("]}")
        f.write("]}") 

#generate new canvas (green so it can be chromakeyed)
def reset_canvas():
    canvas = []
    for j in range(NUM_COL):
        row = []
        for i in range(NUM_ROW):
            color = [0.0,1.0,0.0]
            row.append(color)
        canvas.append(row)

    write_to_json(canvas)