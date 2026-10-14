import ctypes as C, ctypes.util, os
os.environ['EGL_PLATFORM']='surfaceless'
egl=C.CDLL(ctypes.util.find_library('EGL'))
egl.eglGetProcAddress.restype=C.c_void_p;egl.eglGetProcAddress.argtypes=[C.c_char_p]
def ep(name,restype,args):
 f=getattr(egl,name);f.restype=restype;f.argtypes=args;return f
display=ep('eglGetDisplay',C.c_void_p,[C.c_void_p])(None)
major,minor=C.c_int(),C.c_int();assert ep('eglInitialize',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)])(display,C.byref(major),C.byref(minor))
assert ep('eglBindAPI',C.c_uint,[C.c_uint])(0x30A2)
attrs=(C.c_int*13)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038)
config=C.c_void_p();n=C.c_int();assert ep('eglChooseConfig',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)])(display,attrs,C.byref(config),1,C.byref(n)) and n.value
surface=ep('eglCreatePbufferSurface',C.c_void_p,[C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(display,config,(C.c_int*5)(0x3057,4096,0x3056,4096,0x3038))
context=ep('eglCreateContext',C.c_void_p,[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(display,config,None,(C.c_int*7)(0x3098,3,0x30FB,3,0x30FD,1,0x3038))
assert context and surface
assert ep('eglMakeCurrent',C.c_uint,[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p])(display,surface,surface,context)
def gl(name,restype,*args):return C.CFUNCTYPE(restype,*args)(egl.eglGetProcAddress(name.encode()))
if __name__=='__main__':print(gl('glGetString',C.c_char_p,C.c_uint)(0x1F02))
