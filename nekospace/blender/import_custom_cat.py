"""デスクトップの Cat.obj (+ Cat.mtl) を読み込み、グリッド複製されている
うちの1匹だけを取り出して glb に書き出す取り込みスクリプト。
毛色違い(オレンジ/黒/クリーム/グレー)を、同じジオメトリを共有した
リンク複製 + オブジェクト単位のマテリアル上書きで作る。

使い方:
    blender --background --python blender/import_custom_cat.py
"""

import math
import os
import sys

import bpy

OBJ_PATH = os.path.expanduser("~/Desktop/Cat.obj")
KEEP_NAME = "Gato"
FUR_SLOT_NAME = "cat"  # Cat.mtl 内で毛皮に使われているマテリアル名

# script.js の PALETTES と揃えた毛色
FUR_VARIANTS = [
    ("Black", (0.0, 0.0, 0.0)),  # 元モデルそのままの色
    ("Orange", (0.851, 0.459, 0.180)),
    ("Cream", (0.945, 0.906, 0.827)),
    ("Gray", (0.478, 0.502, 0.549)),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_obj(path):
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=path)
    else:
        bpy.ops.import_scene.obj(filepath=path)


def get_principled_bsdf(mat):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        output = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if output is None:
            output = nt.nodes.new("ShaderNodeOutputMaterial")
        output.is_active_output = True
        nt.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return bsdf


def make_fur_variant(base_obj, variant_name, fur_rgb):
    """base_obj とジオメトリを共有するリンク複製を作り、毛皮スロットだけ
    このオブジェクト専用の色に差し替える(耳の内側・鼻などの差し色は共通のまま)。"""
    dup = base_obj.copy()
    bpy.context.collection.objects.link(dup)
    dup.name = f"Cat_{variant_name}"

    for slot in dup.material_slots:
        base_mat = slot.material
        if not base_mat or not base_mat.name.startswith(FUR_SLOT_NAME):
            continue
        new_mat = base_mat.copy()
        new_mat.name = f"Fur_{variant_name}"
        bsdf = get_principled_bsdf(new_mat)
        bsdf.inputs["Base Color"].default_value = (*fur_rgb, 1.0)
        slot.link = "OBJECT"
        slot.material = new_mat

    return dup


def main():
    clear_scene()
    import_obj(OBJ_PATH)

    keep_obj = None
    to_remove = []
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            to_remove.append(obj)
            continue
        if obj.name == KEEP_NAME:
            keep_obj = obj
        else:
            to_remove.append(obj)

    if keep_obj is None:
        names = [o.name for o in bpy.data.objects]
        raise RuntimeError(f"'{KEEP_NAME}' が見つかりません。読み込まれたオブジェクト: {names}")

    for obj in to_remove:
        bpy.data.objects.remove(obj, do_unlink=True)

    # 回転・スケールを適用してクリーンにしてから、原点(バウンディングボックス中心)を
    # 頂点データ側に焼き込み直して、オブジェクトを世界原点へ揃える。
    # (location=(0,0,0) だけでは、OBJの頂点座標自体がグリッド配置の位置に
    #  残ったままなので見た目は原点に来ない)
    bpy.ops.object.select_all(action="DESELECT")
    keep_obj.select_set(True)
    bpy.context.view_layer.objects.active = keep_obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    keep_obj.location = (0, 0, 0)

    # サイト側の CAT_SCALE はこれまでの自作猫(だいたい0.7〜0.9くらいの大きさ)を
    # 基準に調整済みなので、このモデル(最大寸法が約1.3)をそれに合わせて縮める。
    # これで script.js 側の数値をいじらずに前と近い見た目サイズになる。
    NORMALIZE_SCALE = 0.6
    keep_obj.scale = (NORMALIZE_SCALE, NORMALIZE_SCALE, NORMALIZE_SCALE)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    for poly in keep_obj.data.polygons:
        poly.use_smooth = True

    used_slots = sorted({slot.material.name for slot in keep_obj.material_slots if slot.material})
    print(f"[import_custom_cat] material slots on {KEEP_NAME}: {used_slots}")

    dims = keep_obj.dimensions
    print(f"[import_custom_cat] dimensions: {dims.x:.3f} x {dims.y:.3f} x {dims.z:.3f}")

    # keep_obj は毛色違いを作るための土台(テンプレート)として使い、
    # 本体はエクスポートしない(4色それぞれの複製だけを書き出す)。
    variants = [make_fur_variant(keep_obj, name, rgb) for name, rgb in FUR_VARIANTS]
    bpy.data.objects.remove(keep_obj, do_unlink=True)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.normpath(os.path.join(script_dir, "..", "assets", "models", "cats.glb"))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for v in variants:
        v.select_set(True)
    bpy.context.view_layer.objects.active = variants[0]
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print(f"[import_custom_cat] exported: {out_path}")


if __name__ == "__main__":
    main()
