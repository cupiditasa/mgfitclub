"""Non-destructive inspection copy of the supplied MG male anatomy GLB."""

import json
import os

import bpy


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCE = os.path.join(ROOT, "assets", "education", "mg-male-anatomy.glb")
OUT_DIR = os.path.join(ROOT, "assets", "education", "blender-review")
BLEND_OUT = os.path.join(OUT_DIR, "mg-male-anatomy-inspection.blend")
REPORT_OUT = os.path.join(OUT_DIR, "mg-male-anatomy-inspection.json")

os.makedirs(OUT_DIR, exist_ok=True)

if not os.path.isfile(SOURCE):
    raise FileNotFoundError(SOURCE)

# Remove only the factory-startup objects in this fresh Blender process.
for startup_object in list(bpy.data.objects.values()):
    bpy.data.objects.remove(startup_object, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=SOURCE, import_select_created_objects=True)

mesh_objects = [obj for obj in bpy.data.objects.values() if obj.type == "MESH"]
rows = []
for obj in mesh_objects:
    mesh = obj.data
    rows.append(
        {
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "polygons": len(mesh.polygons),
            "dimensions": [round(float(value), 5) for value in obj.dimensions],
        }
    )

report = {
    "source": os.path.relpath(SOURCE, ROOT).replace("\\", "/"),
    "mesh_object_count": len(rows),
    "mesh_objects": rows,
    "note": "Inspection-only copy. Source GLB was imported without mesh edits.",
}

with open(REPORT_OUT, "w", encoding="utf-8") as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)

bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT, check_existing=False)
print("MG_ANATOMY_INSPECTION=" + json.dumps(report, ensure_ascii=False))
