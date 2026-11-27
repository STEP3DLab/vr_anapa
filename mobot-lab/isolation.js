// Isolate visible geometry without changing the articulated hierarchy or poses.
// A section may consist of several meshes living under different mechanisms.
export function createIsolation(root) {
  const original = new Map();
  let active = false;
  function restore() {
    for (const [mesh, visible] of original) mesh.visible = visible;
    original.clear(); active = false;
  }
  function apply(selection) {
    restore();
    const nodes = (Array.isArray(selection) ? selection : [selection]).filter(n => n?.isObject3D);
    if (!nodes.length) return false;
    const selected = new Set();
    for (const node of nodes) node.traverse(o => { if (o.isMesh || o.isLine) selected.add(o); });
    let visible = 0;
    root.traverseVisible(o => { if (selected.has(o)) visible++; });
    if (!visible) return false;
    root.traverse(o => {
      if (!o.isMesh && !o.isLine) return;
      original.set(o, o.visible);
      o.visible = o.visible && selected.has(o);
    });
    active = true; return true;
  }
  return {apply, restore, get active() { return active; }};
}
