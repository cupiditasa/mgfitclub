"""Verify the saved Blender review copy contains all imported mesh objects."""

import bpy

meshes = [obj for obj in bpy.data.objects.values() if obj.type == "MESH"]
print("MG_REVIEW_REOPENED_MESH_COUNT=" + str(len(meshes)))
assert len(meshes) == 17, "Expected 17 source mesh objects in the review file"
