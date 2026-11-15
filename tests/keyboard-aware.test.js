import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {usesKeyboard,watchKeyboard} from '../keyboard-aware.js';
test('only fields that raise the keyboard hide the tab bar',async()=>{
 const {window}=new JSDOM('<textarea id=t></textarea><input id=i><input id=s type=search><input id=d type=date><input id=c type=checkbox><button id=b>x</button>');
 const doc=window.document,$=id=>doc.getElementById(id);
 assert.equal(usesKeyboard($('t')),true);assert.equal(usesKeyboard($('s')),true);assert.equal(usesKeyboard($('d')),false);assert.equal(usesKeyboard($('c')),false);
 watchKeyboard(doc);const open=()=>doc.documentElement.classList.contains('keyboard-open');
 $('t').focus();assert.equal(open(),true);
 $('i').focus();assert.equal(open(),true);
 $('b').focus();await new Promise(r=>setTimeout(r,200));assert.equal(open(),false);
});
