"""КОМПАНЬОН / Shiba 01 — parametric prototype. All dimensions in mm.

Based on Apple's 2026-09-09 dimensional drawings, linked in README.
Clearances, simplified continuous corners, and print settings are design assumptions.
Requires cadquery 2.7, shapely 2, svgpathtools, trimesh and mapbox-earcut.
"""
from pathlib import Path
import json, math, zipfile
import cadquery as cq
import numpy as np
import trimesh
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union
from svgpathtools import parse_path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'downloads'
ASSETS = ROOT / 'dist' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)
BACK, WALL, CLEARANCE, ENGRAVE, HEIGHT = 1.8, 1.8, 0.30, 0.60, 11.45

# Original vector illustration, in a 100 x 120 design space.
PATHS = [
 'M25 38 C20 30 18 19 20 10 C30 12 38 19 42 27 C47 24 53 24 58 27 C62 19 70 12 80 10 C82 20 80 31 75 38 C81 45 84 54 79 65 C74 79 64 87 50 89 C36 87 26 79 21 65 C16 54 19 45 25 38 Z',
 'M27 31 C25 25 25 21 26 19 C31 21 35 25 37 29',
 'M63 29 C65 25 69 21 74 19 C75 24 74 28 72 32',
 'M25 53 C30 48 35 48 39 53',
 'M61 53 C65 48 70 48 75 53',
 'M25 63 C32 62 36 65 40 71 C43 75 47 76 50 76 C53 76 57 75 60 71 C64 65 68 62 75 63',
 'M50 65 L50 71 C46 76 42 77 38 74',
 'M50 71 C54 76 58 77 62 74',
 'M29 73 C34 81 40 84 46 85',
 'M54 85 C60 84 66 81 71 73',
 'M31 83 C28 91 25 95 17 101 C13 104 11 108 10 113',
 'M69 83 C72 91 75 95 83 101 C87 104 89 108 90 113',
 'M29 91 Q50 101 71 91',
 'M25 98 Q50 108 75 98',
 'M50 101 L50 108',
 'M46 110 Q50 107 54 110 L54 115 Q50 119 46 115 Z',
]
FILLS = [
 'M43 61 C45 58 55 58 57 61 C56 65 53 67 50 67 C47 67 44 65 43 61 Z',
]

def svg():
    paths=''.join(f'<path d="{p}"/>' for p in PATHS)
    fills=''.join(f'<path d="{p}" fill="currentColor" stroke="none"/>' for p in FILLS)
    eyes='<ellipse cx="33" cy="55" rx="1.8" ry="2.1" fill="currentColor"/><ellipse cx="67" cy="55" rx="1.8" ry="2.1" fill="currentColor"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 124" fill="none" color="#333c31" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">{paths}{fills}{eyes}</svg>'

(ASSETS/'shiba.svg').write_text(svg())
(OUT/'shiba-engraving.svg').write_text(svg())

def path_points(p, scale=.66):
    path=parse_path(p)
    n=max(40, int(path.length() * 2))
    return [((path.point(i/n).real-50)*scale, (62-path.point(i/n).imag)*scale-18) for i in range(n+1)]

def engraving_polygons():
    parts=[LineString(path_points(p)).buffer(.48, cap_style=1, join_style=1) for p in PATHS]
    parts += [Polygon(path_points(p)).buffer(0) for p in FILLS]
    parts += [Point((x-50)*.66,(62-55)*.66-18).buffer(1.20, resolution=20) for x in (33,67)]
    # Small, restrained four-point star above the portrait.
    star=[(0,29),(1,25.5),(4.5,24.5),(1,23.5),(0,20),(-1,23.5),(-4.5,24.5),(-1,25.5)]
    parts += [Polygon(star)]
    u=unary_union(parts).simplify(.025,preserve_topology=True)
    return list(u.geoms) if hasattr(u,'geoms') else [u]

def polygon_solid(poly,z,height):
    outer=cq.Wire.makePolygon([cq.Vector(x,y,z) for x,y in list(poly.exterior.coords)], close=True)
    holes=[cq.Wire.makePolygon([cq.Vector(x,y,z) for x,y in ring.coords],close=True) for ring in poly.interiors]
    return cq.Solid.extrudeLinear(outer,holes,cq.Vector(0,0,height))

def phone_outline(w,h):
    # Sampled continuous corner profile, not a circular corner. Values from Detail A.
    r=19.43
    c=[(13.90,.04),(8.46,.92),(3.80,3.80),(.92,8.46),(.04,13.90),(0,r)]
    wp=cq.Workplane('XY').moveTo(-w/2+r,h/2).lineTo(w/2-r,h/2)
    wp=wp.spline([(w/2-a,h/2-b) for a,b in c],includeCurrent=True)
    wp=wp.lineTo(w/2,-h/2+r).spline([(w/2-b,-h/2+a) for a,b in c],includeCurrent=True)
    wp=wp.lineTo(-w/2+r,-h/2).spline([(-w/2+a,-h/2+b) for a,b in c],includeCurrent=True)
    wp=wp.lineTo(-w/2,h/2-r).spline([(-w/2+b,h/2-a) for a,b in c],includeCurrent=True).close()
    return wp.val()

def offset(wire,d):
    return wire.offset2D(d,kind='arc')[0]

def extrude(wire,z,height):
    return cq.Solid.extrudeLinear(wire.translate((0,0,z)),[],cq.Vector(0,0,height))

def rounded_box(w,h,depth,r,plane='XY'):
    return cq.Workplane(plane).rect(w,h).extrude(depth).edges('|' + {'XY':'Z','YZ':'X','XZ':'Y'}[plane]).fillet(r).val()

def build(key,w,h,cc):
    print('Building',key,flush=True)
    outline=phone_outline(w,h)
    outer=extrude(offset(outline,CLEARANCE+WALL),0,HEIGHT)
    # Soften the rim and the outer back perimeter before making openings.
    outer=cq.Workplane(obj=outer).faces('<Z or >Z').edges().fillet(.35).val()
    cavity=extrude(offset(outline,CLEARANCE),BACK,8.4)
    # A sloping 0.65 mm TPU retaining lip, with no hard snap hooks.
    loft=cq.Solid.makeLoft([offset(outline,CLEARANCE).translate((0,0,10.0)),offset(outline,-.35).translate((0,0,HEIGHT+.1))])
    body=outer.cut(cavity.fuse(loft))
    camera=rounded_box(w-5.2,44.5,6,11).translate((0,h/2-24,-2))
    body=body.cut(camera)
    # Side buttons. Capsule windows leave tactile buttons exposed.
    z=BACK+4.375
    for top,L in [(34.28,11),(48.43,15),(62.63,15)]:
        tool=rounded_box(L,5.8,8,2.8,'YZ').translate((-w/2-4,h/2-top,z))
        body=body.cut(tool)
    for top,L,H in [(55.53,22,5.8),(cc,32,8.2)]:
        tool=rounded_box(L,H,8,min(2.8,H/2-.05),'YZ').translate((w/2-4,h/2-top,z))
        body=body.cut(tool)
    # XZ extrudes in the -Y direction.
    for x,L,H in [(0,14,7),(-20,15,4.0),(20,15,4.0)]:
        tool=rounded_box(L,H,8,min(1.8,H/2-.05),'XZ').translate((x,-h/2+4,z))
        body=body.cut(tool)
    cutters=[polygon_solid(p,-.25,ENGRAVE+.25) for p in engraving_polygons()]
    body=body.cut(cq.Compound.makeCompound(cutters)).clean()
    if not body.isValid() or len(body.Solids())!=1:
        raise ValueError(f'Invalid CAD solid {key}')
    base=OUT/f'kompanion-iphone-18-{key}'
    cq.exporters.export(body,str(base.with_suffix('.step')))
    cq.exporters.export(body,str(base.with_suffix('.stl')),tolerance=.035,angularTolerance=.10)
    mesh=trimesh.load_mesh(base.with_suffix('.stl'),process=True)
    if not mesh.is_watertight or not mesh.is_winding_consistent or len(mesh.split()) != 1:
        raise ValueError(f'Invalid print mesh {key}')
    # A short bottom section is a cheaper first test of width, corner profile and lip.
    crop=cq.Workplane('XY').box(200,20,40).translate((0,-h/2+10,10)).val()
    sample=body.intersect(crop)
    cq.exporters.export(sample,str(OUT/f'fit-test-iphone-18-{key}.stl'),tolerance=.035,angularTolerance=.10)
    # GLB preview uses precisely the same tessellation as the downloadable STL.
    # The darker groove material only helps the viewer read actual recessed faces.
    tri=mesh.triangles
    floors=np.all(np.abs(tri[:,:,2]-ENGRAVE)<.002,axis=1)
    scene=trimesh.Scene()
    for name,mask,color in [('case',~floors,[120,132,102,255]),('engraving',floors,[51,60,43,255])]:
        part=mesh.submesh([np.flatnonzero(mask)],append=True)
        part.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=name,baseColorFactor=color,roughnessFactor=.8,metallicFactor=0.0))
        scene.add_geometry(part,node_name=name,geom_name=name)
    (ASSETS/f'{key}.glb').write_bytes(scene.export(file_type='glb'))
    # Lower-poly CPU fallback for browsers without WebGL. Never used for printing.
    lite=mesh.simplify_quadric_decimation(face_count=24000,aggression=3)
    lite_floors=np.all(np.abs(lite.triangles[:,:,2]-ENGRAVE)<.005,axis=1)
    lite_scene=trimesh.Scene()
    for name,mask,color in [('case',~lite_floors,[120,132,102,255]),('engraving',lite_floors,[51,60,43,255])]:
        part=lite.submesh([np.flatnonzero(mask)],append=True)
        part.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=name,baseColorFactor=color,roughnessFactor=.8))
        lite_scene.add_geometry(part,node_name=name,geom_name=name)
    (ASSETS/f'{key}-lite.glb').write_bytes(lite_scene.export(file_type='glb'))
    report={'model':f'iPhone 18 {"Pro" if key=="pro" else "Pro Max"}',
            'phone_mm':[w,h,8.75],'case_mm':[round(float(v),2) for v in mesh.extents],
            'back_mm':BACK,'wall_mm':WALL,'clearance_per_side_mm':CLEARANCE,
            'engraving_depth_mm':ENGRAVE,'engraving_min_stroke_mm':.96,
            'remaining_back_at_engraving_mm':round(BACK-ENGRAVE,2),
            'volume_cm3':round(body.Volume()/1000,2),'estimated_tpu_g':round(body.Volume()/1000*1.20,1),
            'cad_valid':body.isValid(),'solid_count':len(body.Solids()),'watertight':bool(mesh.is_watertight),
            'consistent_winding':bool(mesh.is_winding_consistent),'connected_components':len(mesh.split()),
            'triangles':len(mesh.faces),'stl_bytes':base.with_suffix('.stl').stat().st_size,
            'units':'mm','status':'Prototype — physical fit not tested'}
    print(json.dumps(report),flush=True)
    return report

if __name__=='__main__':
    reports={key:build(key,*args) for key,args in {'pro':(71.85,150.01,98.40),'pro-max':(77.98,163.43,111.82)}.items()}
    (OUT/'validation.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False))
    (ASSETS/'models.json').write_text(json.dumps(reports,ensure_ascii=False))
