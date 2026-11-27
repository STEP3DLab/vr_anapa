import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../engine/three.module.min.js';
import {machines} from '../catalog.js';
import {inspections} from '../inspection.js';
import {createIsolation} from '../isolation.js';

// The mobile geometry can be constructed in Node without canvas textures.
globalThis.document = {createElement: () => ({getContext: () => null})};

function visibleMeshes(root) {
  const result = [];
  root.traverseVisible(node => { if (node.isMesh) result.push(node); });
  return result;
}

function selectionMeshes(selection) {
  const nodes = Array.isArray(selection) ? selection : [selection];
  const meshes = new Set();
  assert(nodes.length, 'A complete assembly has at least one root');
  for (const node of nodes) {
    assert(node?.isObject3D, 'Selections contain real scene objects');
    node.traverse(child => { if (child.isMesh) meshes.add(child); });
  }
  return meshes;
}

function snapshot(root) {
  const state = new Map();
  root.traverse(node => state.set(node, {
    parent: node.parent,
    visible: node.visible,
    position: node.position.toArray(),
    quaternion: node.quaternion.toArray(),
    scale: node.scale.toArray()
  }));
  return state;
}

function assertUnchangedTransforms(before) {
  for (const [node, state] of before) {
    assert.equal(node.parent, state.parent, node.name + ' keeps its parent');
    assert.deepEqual(node.position.toArray(), state.position, node.name + ' keeps its position');
    assert.deepEqual(node.quaternion.toArray(), state.quaternion, node.name + ' keeps its rotation');
    assert.deepEqual(node.scale.toArray(), state.scale, node.name + ' keeps its scale');
  }
}

function assertRestored(before) {
  assertUnchangedTransforms(before);
  for (const [node, state] of before) assert.equal(node.visible, state.visible, node.name + ' restores visibility');
}

function ids(nodes) { return [...nodes].map(node => node.uuid).sort(); }

for (const year of [1986, 1987]) {
  test(year + ': all seven assemblies isolate without changing the model or revealing hidden tools', () => {
    const model = machines[year].create(T);
    const isolation = createIsolation(model.root);
    assert.equal(inspections[year].length, 7);
    const tools = year === 1987 ? ['gripper', 'breaker-arm', 'breaker-loader'] : [null];
    for (const tool of tools) {
      if (tool) model.mechanisms.setWorkTool(tool);
      const baseline = snapshot(model.root);
      const originallyVisible = visibleMeshes(model.root);
      for (const part of inspections[year]) {
        const anchor = part.anchor(model);
        assert(anchor?.isObject3D, year + ' ' + part.id + ' has a marker');
        assert(!new T.Box3().setFromObject(anchor).isEmpty(), part.id + ' marker has geometry');
        const selection = part.selection(model);
        const selected = selectionMeshes(selection);
        for (const node of selected) assert(baseline.has(node), part.id + ' belongs to this model');
        const expected = originallyVisible.filter(node => selected.has(node));
        assert(expected.length > 0, part.id + ' selection is visible for ' + (tool || 'grapple'));
        assert(expected.length < originallyVisible.length, part.id + ' selects an assembly, not the whole machine');
        assert.equal(isolation.apply(selection), true);
        assert.equal(isolation.active, true);
        assert.deepEqual(ids(visibleMeshes(model.root)), ids(expected), part.id + ' shows only originally visible assembly meshes');
        assertUnchangedTransforms(baseline);
        isolation.restore();
        assert.equal(isolation.active, false);
        assertRestored(baseline);
      }
    }
  });

  test(year + ': switching isolated assemblies preserves the original visibility snapshot', () => {
    const model = machines[year].create(T);
    if (year === 1987) model.mechanisms.setWorkTool('breaker-loader');
    const isolation = createIsolation(model.root);
    const baseline = snapshot(model.root);
    const originallyVisible = visibleMeshes(model.root);
    const body = inspections[year].find(part => part.id === 'body');
    const track = inspections[year].find(part => part.id === 'track');
    assert.equal(isolation.apply(body.selection(model)), true);
    assert.equal(isolation.apply(track.selection(model)), true);
    const selected = selectionMeshes(track.selection(model));
    assert.deepEqual(ids(visibleMeshes(model.root)), ids(originallyVisible.filter(node => selected.has(node))));
    isolation.restore();
    isolation.restore();
    assertRestored(baseline);
    assert.equal(isolation.active, false);
  });
}
