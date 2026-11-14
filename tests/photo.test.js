import {test} from 'node:test';import assert from 'node:assert/strict';
import {resizedDimensions,dataURLBytes} from '../image-processing.js';
import {activeMembership,recordSave,canShowInterstitial} from '../monetization-core.js';
test('large images are resized without upscaling or aspect-ratio loss',()=>{assert.deepEqual(resizedDimensions(4032,3024),{width:1440,height:1080});assert.deepEqual(resizedDimensions(300,400),{width:300,height:400});assert.throws(()=>resizedDimensions(10000,10000));});
test('base64 padding is excluded from compressed size',()=>{assert.equal(dataURLBytes('data:image/jpeg;base64,YQ=='),1);assert.equal(dataURLBytes('data:image/jpeg;base64,YWI='),2);});
test('expired membership cannot unlock photos and ads are frequency limited',()=>{assert.equal(activeMembership({premium:true,premiumUntil:100},101),false);let counts;for(let i=0;i<3;i++)counts=recordSave(counts,1000000);assert.equal(canShowInterstitial(counts,1000000),true);assert.equal(canShowInterstitial({...counts,shown:2},1000000),false);assert.equal(canShowInterstitial({...counts,lastShown:999999},1000000),false);});
