import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,candidates,demo,requestBody,recipes} from './catalog.mjs';
test('non-alcohol restriction is enforced before both selection paths',()=>{const input=validate({preference:'zero',features:{bass:.9,brightness:.8,energy:.7}});assert.equal(candidates(input).length,6);assert.equal(demo(input).alcohol,false);const ids=Object.keys(requestBody(input).questions.cocktail.criteria);assert.ok(ids.every(id=>recipes.find(r=>r.id===id).alcohol===false));});
test('invalid and missing measurements are rejected',()=>{for(const value of [null,{}, {energy:NaN,brightness:.5,bass:.5},{energy:2,brightness:.5,bass:.5},{energy:'1',brightness:.5,bass:.5}])assert.throws(()=>validate({preference:'all',features:value}));});
test('normalization prevents property-order dependent selection',()=>{const a=validate({preference:'all',features:{energy:.8,brightness:.2,bass:.6}});const b=validate({preference:'all',features:{bass:.6,brightness:.2,energy:.8}});assert.equal(demo(a).id,demo(b).id);});
test('audio contrast produces different demo pairings and all recipe IDs are unique',()=>{assert.equal(new Set(recipes.map(r=>r.id)).size,20);const run=features=>demo(validate({features,preference:'all'})).id;assert.notEqual(run({energy:.2,brightness:.2,bass:.75}),run({energy:.75,brightness:.8,bass:.4}));});
