import json

NUM_COL = 10
NUM_ROW = 10

canvas =[]

#initialize with white pixels [r,g,b]

for j in range(NUM_COL):
    row = []
    for i in range(NUM_ROW):
        row.append([255,255,255])
    canvas.append(row)

# write to json file with own encoding
with open('canvas.json', 'w', newline='') as f:
    f.write("{\"data\":{")
    #json.dump(data, f, separators=(',',':'))
    f.write("\"p_row0\":{")
    f.write("\"p_"+str(0)+"_"+str(0)+"\":{\"r\":"+str(canvas[0][0][0])+",\"g\":"+str(canvas[0][0][1])+",\"b\":"+str(canvas[0][0][2]))
    for j in range(1, len(canvas[0])):
        f.write("},") 
        f.write("\"p_"+str(0)+"_"+str(j)+"\":{\"r\":"+str(canvas[0][j][0])+",\"g\":"+str(canvas[0][j][1])+",\"b\":"+str(canvas[0][j][2]))
    f.write("}")
    for i in range(1,len(canvas)):
        f.write("},\"p_row"+str(i)+"\":{")
        f.write("\"p_"+str(i)+"_"+str(0)+"\":{\"r\":"+str(canvas[i][0][0])+",\"g\":"+str(canvas[i][0][1])+",\"b\":"+str(canvas[i][0][2]))
        for k in range(1,len(canvas[i])):
            f.write("},") 
            f.write("\"p_"+str(i)+"_"+str(k)+"\":{\"r\":"+str(canvas[i][k][0])+",\"g\":"+str(canvas[i][k][1])+",\"b\":"+str(canvas[i][k][2]))
        f.write("}")
    f.write("}")
    f.write("}")
    f.write("}")