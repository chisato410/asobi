"""なめらかでかわいい猫を4種類つくって glb に書き出す Blender スクリプト。

script.js のプロシージャル猫(フォールバック)と見た目を揃えてある:
丸い頭・ほっぺ・マズル・ひげ・キャッチライト付きの目・しっぽはカーブで
なめらかに曲げる。ポリゴン感を抑えたスムーズシェード。

使い方 (このフォルダ = nekospace/ から):
    blender --background --python blender/build_cats.py

出力先を変えたい場合:
    blender --background --python blender/build_cats.py -- /path/to/out.glb

Blender 3.6 / 4.x で確認。GUI で開いて眺めたいときは
`blender --python blender/build_cats.py` (--background なし) でもOK。
"""

import math
import os
import random
import sys

import bpy


# ---------------------------------------------------------------------------
# セットアップ
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.objects):
        for block in list(data):
            if block.users == 0:
                data.remove(block)


def get_principled_bsdf(mat):
    """ノード名は Blender のバージョンやローカライズで変わりうるので、
    英語名の決め打ちではなくノードタイプで探す。無ければ作って
    Material Output に繋ぎ直す。"""
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    output = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    if output is None:
        output = nt.nodes.new("ShaderNodeOutputMaterial")
    # 新規追加した Material Output は is_active_output が False のことがあり、
    # その場合レンダー/エクスポートには古いデフォルト(灰色)が使われてしまう。
    output.is_active_output = True
    linked = any(link.from_node == bsdf and link.to_node == output for link in nt.links)
    if not linked:
        nt.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return bsdf


def make_material(name, color, roughness=0.7):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = get_principled_bsdf(mat)
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.2
    return mat


def make_emissive_material(name, color, strength=1.6, base=(0.02, 0.02, 0.03)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = get_principled_bsdf(mat)
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.25
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (*color, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def make_tabby_image(name, fur_color, stripe_color, w=128, h=64):
    """トラ猫の縞模様を実ピクセルとして焼き込む。
    glTF は手続き型のシェーダーノードを書き出せず、実際の画像テクスチャか
    定数カラーしか扱えないため、UVスフィアの既定UV(経度/緯度)に載る
    ビットマップとして作る(JS版のcanvas生成テクスチャと同じ考え方)。"""
    img = bpy.data.images.new(name, width=w, height=h)
    stripe_count = 9
    rng = random.Random(abs(hash(name)) % (2**16))
    stripe_xs = [(i + 0.5) / stripe_count * w + rng.uniform(-3, 3) for i in range(stripe_count)]
    stripe_half_width = w * 0.03

    pixels = [0.0] * (w * h * 4)
    for y in range(h):
        wobble = math.sin(y * 0.35) * (w * 0.02)
        shade = 1.0 + (0.5 - y / h) * 0.16
        for x in range(w):
            idx = (y * w + x) * 4
            d = min(abs(x - (sx + wobble)) for sx in stripe_xs)
            t = max(0.0, 1.0 - d / stripe_half_width)
            t = t * t * (3 - 2 * t)  # smoothstep
            for c in range(3):
                base = fur_color[c] * (1 - t) + stripe_color[c] * t
                pixels[idx + c] = min(1.0, max(0.0, base * shade))
            pixels[idx + 3] = 1.0
    img.pixels[:] = pixels
    img.pack()
    return img


def make_tabby_material(name, fur_color, stripe_color, roughness=0.75):
    """焼き込み画像を Base Color に繋いだ、トラ猫用のマテリアル。"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = get_principled_bsdf(mat)
    bsdf.inputs["Roughness"].default_value = roughness

    image = make_tabby_image(f"FurTex_{name}", fur_color, stripe_color)
    tex_node = nt.nodes.new("ShaderNodeTexImage")
    tex_node.image = image
    nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def shade_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if hasattr(obj.data, "use_auto_smooth"):
        obj.data.use_auto_smooth = True


def new_empty(name, location=(0, 0, 0)):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_size = 0.05
    empty.location = location
    bpy.context.collection.objects.link(empty)
    return empty


def parent_keep_transform(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


# ---------------------------------------------------------------------------
# パーツ生成
# ---------------------------------------------------------------------------

def add_uv_sphere(name, radius, location, scale=(1, 1, 1), material=None, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, location=location, segments=segments, ring_count=rings
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    if material:
        obj.data.materials.append(material)
    return obj


def add_cone(name, radius1, radius2, depth, location, rotation, vertices=16, material=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.shade_smooth()
    if material:
        obj.data.materials.append(material)
    return obj


def add_whisker(name, location, side, fan_index, length, material):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.003, depth=length, location=location, vertices=5
    )
    obj = bpy.context.active_object
    obj.name = name
    # 片端を原点に揃え、そこから length ぶん伸びる棒にする
    for v in obj.data.vertices:
        v.co.z += length / 2.0
    # Blenderのシリンダーはローカル Z 軸方向に伸びるため(Three.jsのY軸とは違う)、
    # Y回転で顔の外向き(X方向)へ振ってから、X/Zの小さな回転で扇状にばらす。
    i = fan_index
    obj.rotation_euler = (
        (i - 1) * 0.12,
        side * (math.pi / 2 - 0.14 + i * 0.12),
        (i - 1) * 0.08,
    )
    obj.data.materials.append(material)
    return obj


def build_ear(name_prefix, side, head_radius, head_loc, fur_mat, inner_mat, parent):
    # add_cone の location はワールド座標として解決されるため、頭の位置(head_loc)を
    # 自分で足し込まないと、頭を動かしたときに耳だけ置いてけぼりになる。
    x = head_loc[0] + side * head_radius * 0.56
    y = head_loc[1] - head_radius * 0.08
    z = head_loc[2] + head_radius * 0.86
    base = (x, y, z)
    ear = add_cone(
        name_prefix, radius1=head_radius * 0.32, radius2=0.0, depth=head_radius * 0.52,
        location=base, rotation=(0.1, side * -0.2, side * 0.5), vertices=16, material=fur_mat,
    )
    inner = add_cone(
        f"{name_prefix}Inner", radius1=head_radius * 0.18, radius2=0.0, depth=head_radius * 0.3,
        location=(x - side * 0.008, y - head_radius * 0.04, z - head_radius * 0.08),
        rotation=ear.rotation_euler, vertices=12, material=inner_mat,
    )
    parent_keep_transform(ear, parent)
    parent_keep_transform(inner, ear)
    return ear


def build_tail(name, body_radius, body_loc, fur_mat, parent):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = body_radius * 0.15
    curve_data.bevel_resolution = 4
    curve_data.fill_mode = "FULL"

    # 体の後ろから伸びて、先端でくるっと上向きに巻くしっぽ
    spline = curve_data.splines.new("BEZIER")
    points = [
        (0, body_loc[1] - body_radius * 0.85, body_loc[2] + 0.03),
        (0.03, body_loc[1] - body_radius * 1.7, body_loc[2] - 0.08),
        (0.17, body_loc[1] - body_radius * 2.5, body_loc[2] + 0.12),
        (0.2, body_loc[1] - body_radius * 2.1, body_loc[2] + 0.26),
    ]
    spline.bezier_points.add(len(points) - 1)
    for i, co in enumerate(points):
        bp = spline.bezier_points[i]
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    spline.bezier_points[0].radius = 1.1
    spline.bezier_points[-1].radius = 0.35

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(fur_mat)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    shade_smooth(obj)

    parent_keep_transform(obj, parent)
    return obj


def build_cat(variant_name, fur_color, stripe_color, belly_color, inner_ear_color, nose_color, eye_glow, pattern):
    # ルートは必ず原点に置く(4匹ともここで重なって生成される)。
    # パーツは add_cone/add_uv_sphere にワールド座標をそのまま渡し、
    # parent_keep_transform で「今の見た目のまま」親子付けしているので、
    # もしルートをオフセットすると、そのオフセット分を打ち消す変換が
    # 各パーツのローカル変換に焼き込まれてしまう。Three.js 側でクローンを
    # 別の場所へ再配置すると、そのローカル変換だけ引き継がれて見た目が
    # 元のワールド座標(≒原点付近)にズレて出てしまう実害があったため、
    # 「原点に置いてから、書き出し後にThree.js側で動かす」運用に統一する。
    root = new_empty(f"Cat_{variant_name}", location=(0, 0, 0))

    if pattern == "tabby":
        fur_mat = make_tabby_material(f"Fur_{variant_name}", fur_color, stripe_color)
    else:
        fur_mat = make_material(f"Fur_{variant_name}", fur_color, roughness=0.78)
    belly_mat = make_material(f"Belly_{variant_name}", belly_color, roughness=0.85)
    inner_mat = make_material(f"InnerEar_{variant_name}", inner_ear_color, roughness=0.6)
    nose_mat = make_material(f"Nose_{variant_name}", nose_color, roughness=0.4)
    catchlight_mat = make_emissive_material(f"Catchlight_{variant_name}", (1, 1, 1), strength=1.0, base=(1, 1, 1))
    whisker_mat = make_material(f"Whisker_{variant_name}", (0.96, 0.94, 0.88), roughness=0.5)
    sclera_mat = make_material(f"Sclera_{variant_name}", (0.96, 0.95, 0.91), roughness=0.35)
    pupil_mat = make_emissive_material(f"Pupil_{variant_name}", eye_glow, strength=0.5, base=(0.04, 0.04, 0.05))

    # マスコット風プロポーション: 頭を大きく主役にし、体は小さく添える。
    # (同じくらいの大きさの球を2つくっつけると雪だるまに見えるので、
    #  頭と体の大きさをはっきり変えて「丸の集合」に見せない)
    head_radius = 0.3
    head_loc = (0, 0.02, 0.1)
    head = add_uv_sphere("Head", head_radius, head_loc, scale=(1.05, 1.0, 0.98), material=fur_mat)
    parent_keep_transform(head, root)

    body_radius = head_radius * 0.66
    body_loc = (0, -0.01, -0.27)
    body = add_uv_sphere("Body", body_radius, body_loc, scale=(1.0, 0.95, 0.92), material=fur_mat)
    parent_keep_transform(body, root)

    belly = add_uv_sphere("Belly", body_radius * 0.68,
                           (0, body_loc[1] + body_radius * 0.55, body_loc[2] - 0.02),
                           scale=(0.82, 0.85, 0.75), material=belly_mat, segments=16, rings=12)
    parent_keep_transform(belly, root)

    nose = add_uv_sphere("Nose", head_radius * 0.09,
                          (0, head_loc[1] + head_radius * 1.0, head_loc[2] - head_radius * 0.08),
                          scale=(1.0, 0.55, 0.7), material=nose_mat, segments=8, rings=6)
    parent_keep_transform(nose, head)

    for side, tag in ((1, "R"), (-1, "L")):
        for i in range(3):
            whisker = add_whisker(
                f"Whisker{tag}{i}",
                location=(
                    side * head_radius * 0.16,
                    head_loc[1] + head_radius * 0.88,
                    head_loc[2] - head_radius * 0.02 - i * 0.018,
                ),
                side=side, fan_index=i,
                length=0.2, material=whisker_mat,
            )
            parent_keep_transform(whisker, head)

    for side, tag in ((1, "R"), (-1, "L")):
        build_ear(f"Ear{tag}", side, head_radius, head_loc, fur_mat, inner_mat, head)

    # 目: 白目+黒目の大きな二枚構成で、まん丸のかわいい表情にする
    for side, tag in ((1, "R"), (-1, "L")):
        eye_root = new_empty(f"Eye{tag}", location=(
            side * head_radius * 0.42, head_loc[1] + head_radius * 0.85, head_loc[2] + head_radius * 0.1,
        ))
        parent_keep_transform(eye_root, head)
        eye_root.rotation_euler = (0, side * -0.15, 0)

        sclera = add_uv_sphere(f"Sclera{tag}", head_radius * 0.32, (0, 0, 0), scale=(1.0, 0.55, 1.0),
                                material=sclera_mat, segments=16, rings=14)
        parent_keep_transform(sclera, eye_root)

        pupil = add_uv_sphere(f"Pupil{tag}", head_radius * 0.17, (0, head_radius * 0.14, -head_radius * 0.02),
                               scale=(1.0, 0.6, 1.0), material=pupil_mat, segments=12, rings=10)
        parent_keep_transform(pupil, eye_root)

        catch = add_uv_sphere(f"Catchlight{tag}", head_radius * 0.05,
                               (side * -0.02, head_radius * 0.24, head_radius * 0.05),
                               material=catchlight_mat, segments=6, rings=6)
        parent_keep_transform(catch, eye_root)

    build_tail("Tail", body_radius, body_loc, fur_mat, root)

    # 前足だけを体の下に小さく覗かせる
    for side, tag in ((1, "R"), (-1, "L")):
        paw = add_uv_sphere(f"Paw{tag}", body_radius * 0.28,
                             (side * body_radius * 0.58, body_loc[1] + body_radius * 0.35,
                              body_loc[2] - body_radius * 0.88),
                             scale=(0.9, 1.0, 0.7), material=fur_mat, segments=14, rings=10)
        parent_keep_transform(paw, root)

    return root


VARIANTS = [
    dict(name="Orange", fur=(0.87, 0.5, 0.24), stripe=(0.54, 0.29, 0.12), belly=(0.96, 0.9, 0.79),
         inner=(0.98, 0.75, 0.75), nose=(0.91, 0.56, 0.63), glow=(0.3, 0.95, 0.55), pattern="tabby"),
    dict(name="Black", fur=(0.11, 0.11, 0.13), stripe=(0.11, 0.11, 0.13), belly=(0.27, 0.27, 0.3),
         inner=(0.42, 0.23, 0.27), nose=(0.54, 0.35, 0.41), glow=(1.0, 0.7, 0.15), pattern="solid"),
    dict(name="Cream", fur=(0.94, 0.9, 0.83), stripe=(0.86, 0.74, 0.56), belly=(1.0, 0.98, 0.94),
         inner=(0.95, 0.6, 0.65), nose=(0.94, 0.64, 0.68), glow=(0.3, 0.6, 1.0), pattern="tabby"),
    dict(name="Gray", fur=(0.48, 0.5, 0.55), stripe=(0.29, 0.31, 0.35), belly=(0.85, 0.86, 0.89),
         inner=(0.85, 0.6, 0.65), nose=(0.85, 0.56, 0.63), glow=(0.65, 0.4, 0.95), pattern="tabby"),
]


def main():
    clear_scene()
    for v in VARIANTS:
        build_cat(
            v["name"], v["fur"], v["stripe"], v["belly"], v["inner"], v["nose"], v["glow"],
            v["pattern"],
        )

    out_path = None
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1:]
        if extra:
            out_path = extra[0]
    if not out_path:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.normpath(os.path.join(script_dir, "..", "assets", "models", "cats.glb"))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print(f"[build_cats] exported: {out_path}")


if __name__ == "__main__":
    main()
