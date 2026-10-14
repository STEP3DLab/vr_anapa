"""Offline render of exported production geometry, via native Mesa/EGL (no browser).
The diagnostic PBR shader is separate from Three.js; this is not WebGL runtime QA.
"""
from io import BytesIO
import importlib.util,ctypes as C,json,numpy as np
from PIL import Image
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
spec=importlib.util.spec_from_file_location('egl',Path(__file__).with_name('native_egl.py'));egl=importlib.util.module_from_spec(spec);spec.loader.exec_module(egl);gl=egl.gl
U=C.c_uint;I=C.c_int;F=C.c_float;V=C.c_void_p;S=C.c_char_p
def fn(name,restype,*args):return gl(name,restype,*args)
genbuffers=fn('glGenBuffers',None,I,C.POINTER(U));bindbuffer=fn('glBindBuffer',None,U,U);bufferdata=fn('glBufferData',None,U,C.c_ssize_t,V,U)
genvao=fn('glGenVertexArrays',None,I,C.POINTER(U));bindvao=fn('glBindVertexArray',None,U);enableattr=fn('glEnableVertexAttribArray',None,U);pointer=fn('glVertexAttribPointer',None,U,I,U,U,I,V)
gentex=fn('glGenTextures',None,I,C.POINTER(U));bindtex=fn('glBindTexture',None,U,U);teximage=fn('glTexImage2D',None,U,I,I,I,I,I,U,U,V);texparam=fn('glTexParameteri',None,U,U,I);active=fn('glActiveTexture',None,U)
getuniform=fn('glGetUniformLocation',I,U,S);u1i=fn('glUniform1i',None,I,I);u1f=fn('glUniform1f',None,I,F);u2f=fn('glUniform2f',None,I,F,F);u3f=fn('glUniform3f',None,I,F,F,F);umatrix=fn('glUniformMatrix4fv',None,I,I,U,V)
use=fn('glUseProgram',None,U);draw=fn('glDrawArrays',None,U,I,I);enable=fn('glEnable',None,U);disable=fn('glDisable',None,U);viewport=fn('glViewport',None,I,I,I,I);clear=fn('glClear',None,U);clearcolor=fn('glClearColor',None,F,F,F,F)
genfbo=fn('glGenFramebuffers',None,I,C.POINTER(U));bindfbo=fn('glBindFramebuffer',None,U,U);attach=fn('glFramebufferTexture2D',None,U,U,U,U,I);drawbuffer=fn('glDrawBuffer',None,U);readbuffer=fn('glReadBuffer',None,U)
def program(vertex,fragment):
 p=fn('glCreateProgram',U)()
 for kind,source in [(0x8B31,vertex),(0x8B30,fragment)]:
  shader=fn('glCreateShader',U,U)(kind);text=S(source.encode());fn('glShaderSource',None,U,I,C.POINTER(S),V)(shader,1,C.byref(text),None);fn('glCompileShader',None,U)(shader);ok=I();fn('glGetShaderiv',None,U,U,C.POINTER(I))(shader,0x8B81,C.byref(ok))
  if not ok.value:
   log=C.create_string_buffer(10000);fn('glGetShaderInfoLog',None,U,I,V,V)(shader,10000,None,log);raise RuntimeError(log.value)
  fn('glAttachShader',None,U,U)(p,shader)
 fn('glLinkProgram',None,U)(p);ok=I();fn('glGetProgramiv',None,U,U,C.POINTER(I))(p,0x8B82,C.byref(ok));assert ok.value
 return p
vertex='''#version 330 core
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;layout(location=2) in vec2 uv;
uniform mat4 projection,view,shadowMatrix;out vec3 P,N;out vec2 UV;out vec4 shadowP;
void main(){P=position;N=normal;UV=uv;shadowP=shadowMatrix*vec4(P,1);gl_Position=projection*view*vec4(P,1);}
'''
fragment='''#version 330 core
in vec3 P,N;in vec2 UV;in vec4 shadowP;out vec4 outputColor;
uniform vec3 base,emissive,camera;uniform float rough,metal,unlit,exposure;uniform bool hasMap;uniform vec2 repeatUV;
uniform sampler2D colorMap,shadowMap;
uniform vec3 lightPos[4],lightTarget[4],lightColor[4];uniform int lightKind[4];uniform vec2 lightCone[4];
const float PI=3.14159265;
vec3 srgb(vec3 v){return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
vec3 display(vec3 v){return mix(v*12.92,1.055*pow(max(v,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),v));}
vec3 aces(vec3 v){return clamp((v*(2.51*v+.03))/(v*(2.43*v+.59)+.14),0.,1.);}
float shadow(){vec3 uv=shadowP.xyz/shadowP.w*.5+.5;if(uv.z>1.||uv.z<0.)return 1.;float s=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(shadowMap,uv.xy+vec2(x,y)/2048.).r;s+=uv.z-.0018>d?.18:1.;}return s/9.;}
vec3 brdf(vec3 n,vec3 v,vec3 l,vec3 albedo){
 vec3 h=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 float a=max(.045,rough*rough),a2=a*a,d=a2/(PI*pow(nh*nh*(a2-1.)+1.,2.));float k=pow(rough+1.,2.)/8.;float g=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 vec3 f0=mix(vec3(.04),albedo,metal),f=f0+(1.-f0)*pow(1.-vh,5.);
 return ((1.-f)*(1.-metal)*albedo/PI+d*g*f/max(4.*nv*nl,.001))*nl;
}
void main(){vec3 albedo=base;if(hasMap)albedo*=srgb(texture(colorMap,UV*repeatUV).rgb);if(unlit>.5){outputColor=vec4(display(albedo),1);return;}
 vec3 n=normalize(N),v=normalize(camera-P);if(!gl_FrontFacing)n=-n;vec3 color=emissive;
 for(int i=0;i<4;i++){vec3 l;float attenuation=1.;if(lightKind[i]==0)l=normalize(lightPos[i]-lightTarget[i]);else{vec3 delta=lightPos[i]-P;float distance=length(delta);l=delta/distance;float cone=dot(-l,normalize(lightTarget[i]-lightPos[i]));attenuation=smoothstep(lightCone[i].x,lightCone[i].y,cone)/max(distance*distance,.01);}color+=brdf(n,v,l,albedo)*lightColor[i]*attenuation*(i==0?shadow():1.);}
 float hemi=n.y*.5+.5;vec3 ambient=mix(vec3(.09,.12,.105),vec3(.28,.27,.23),hemi);color+=albedo*(1.-metal)*ambient;
 vec3 r=reflect(-v,n);float sky=smoothstep(-.5,.8,r.y);vec3 env=mix(vec3(.06,.072,.06),vec3(.42,.43,.38),sky);float stripe=pow(max(0.,sin(atan(r.x,r.z)*6.)),mix(36.,2.,rough));env+=vec3(.45,.38,.24)*stripe*(1.-rough)*smoothstep(-.3,.6,r.y);
 vec3 f0=mix(vec3(.04),albedo,metal);color+=env*f0*.68;
 // Mild near-floor contact darkening, without obscuring metal highlights.
 float contact=1.;for(int i=0;i<4;i++){vec2 c=i==0?vec2(0,-9):i==1?vec2(-5.2,-1.5):i==2?vec2(5.2,-1.5):vec2(-5.2,6.8);float radius=i==0?2.:1.45;float d=length(P.xz-c);if(P.y<.08)contact*=mix(.52,1.,smoothstep(radius*.78,radius*1.22,d));}color*=contact;
 float fog=smoothstep(27.,60.,length(P-camera));color=mix(color,vec3(.014,.02,.014),fog);outputColor=vec4(display(aces(color*exposure)),1.);
}
'''
main=program(vertex,fragment);depth=program('''#version 330 core
layout(location=0) in vec3 position;uniform mat4 shadowMatrix;void main(){gl_Position=shadowMatrix*vec4(position,1);}''','''#version 330 core
void main(){}''')
def save_image(image,path,format,**options):
 buffer=BytesIO();image.save(buffer,format=format,**options);path.write_bytes(buffer.getvalue())

root=Path('gallery-render');scene=json.loads((root/'scene.json').read_text());data=np.fromfile(root/'geometry.bin',dtype=np.float32)
vao=U();genvao(1,C.byref(vao));bindvao(vao);vbo=U();genbuffers(1,C.byref(vbo));bindbuffer(0x8892,vbo);bufferdata(0x8892,data.nbytes,data.ctypes.data,0x88E4)
for index,size,offset in [(0,3,0),(1,3,12),(2,2,24)]:enableattr(index);pointer(index,size,0x1406,0,32,V(offset))
textures=[]
for tex in scene['textures']:
 image=np.array(Image.open(root/f"texture-{tex['id']}.png").convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM));t=U();gentex(1,C.byref(t));bindtex(0x0DE1,t);teximage(0x0DE1,0,0x8058,image.shape[1],image.shape[0],0,0x1908,0x1401,image.ctypes.data)
 for param,val in [(0x2801,0x2601),(0x2800,0x2601),(0x2802,0x2901 if tex['wrap'] else 0x812F),(0x2803,0x2901 if tex['wrap'] else 0x812F)]:texparam(0x0DE1,param,val)
 textures.append(t)
shadow=U();gentex(1,C.byref(shadow));bindtex(0x0DE1,shadow);teximage(0x0DE1,0,0x81A6,2048,2048,0,0x1902,0x1406,None)
for param,val in [(0x2801,0x2600),(0x2800,0x2600),(0x2802,0x812F),(0x2803,0x812F)]:texparam(0x0DE1,param,val)
fbo=U();genfbo(1,C.byref(fbo));bindfbo(0x8D40,fbo);attach(0x8D40,0x8D00,0x0DE1,shadow,0);drawbuffer(0);readbuffer(0)
def loc(p,name):return getuniform(p,name.encode())
def mat(p,name,values):a=np.asarray(values,dtype=np.float32);umatrix(loc(p,name),1,0,a.ctypes.data)
def vec(p,name,values):u3f(loc(p,name),*values)
enable(0x0B71);use(depth);mat(depth,'shadowMatrix',scene['shadow']);viewport(0,0,2048,2048);clear(0x100)
for mesh in scene['meshes']:draw(4,mesh['start'],mesh['count'])
bindfbo(0x8D40,0);use(main);mat(main,'shadowMatrix',scene['shadow']);u1f(loc(main,'exposure'),scene['exposure']);u1i(loc(main,'colorMap'),0);u1i(loc(main,'shadowMap'),1);active(0x84C1);bindtex(0x0DE1,shadow)
for shot in scene['shots']:
 w,h=shot['width']*2,shot['height']*2;viewport(0,0,w,h);clearcolor(.06,.08,.065,1);clear(0x4000|0x100);mat(main,'projection',shot['projection']);mat(main,'view',shot['view']);vec(main,'camera',shot['camera'])
 for i,light in enumerate(shot['lights']):
  vec(main,f'lightPos[{i}]',light['position']);vec(main,f'lightTarget[{i}]',light['target']);vec(main,f'lightColor[{i}]',light['color']);u1i(loc(main,f'lightKind[{i}]'),light['kind']);u2f(loc(main,f'lightCone[{i}]'),np.cos(light['angle']),np.cos(light['angle']*(1-light['penumbra'])))
 for mesh in scene['meshes']:
  material=scene['materials'][mesh['material']];vec(main,'base',material['color']);vec(main,'emissive',material['emissive']);u1f(loc(main,'metal'),material['metal']);u1f(loc(main,'rough'),material['rough']);u1f(loc(main,'unlit'),float(material['unlit']));has=material['texture']>=0;u1i(loc(main,'hasMap'),int(has));u2f(loc(main,'repeatUV'),*(scene['textures'][material['texture']]['repeat'] if has else [1,1]));active(0x84C0);bindtex(0x0DE1,textures[material['texture']] if has else 0);draw(4,mesh['start'],mesh['count'])
 pixels=np.zeros((h,w,4),dtype=np.uint8);fn('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,pixels.ctypes.data);save_image(Image.fromarray(pixels[::-1]).convert('RGB').resize((shot['width'],shot['height']),Image.Resampling.LANCZOS),root/(shot['name']+'.png'),'PNG');print(shot['name'],'rendered',flush=True)

# The website uses only these two compressed stills.
for name,target in [('cover-wide','gallery-wide'),('cover-tall','gallery-tall')]:
 save_image(Image.open(root/(name+'.png')),Path('assets')/(target+'.webp'),'WEBP',quality=88,method=6)
