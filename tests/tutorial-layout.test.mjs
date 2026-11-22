import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tutorialHintTop} from '../public/tutorial-layout.js';
test('mobile hints clear the highest control on portrait, small and landscape screens',()=>{
  for(const height of [844,568,390]) for(const hintHeight of [44,64]) {
    const controls=[{top:height-300,width:58,height:58},{top:height-150,width:124,height:88},{top:0,width:0,height:0}];
    const top=tutorialHintTop(height,hintHeight,controls);
    assert.ok(top>=8);assert.ok(top+hintHeight<=controls[0].top-16);
  }
});
