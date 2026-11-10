import { test } from 'node:test';
import assert from 'node:assert/strict';
import raw from '../panel/emoji-data.js';
import {prepareData,searchEmoji,glyph,readPreferences,remember,layoutRows,visibleRows,CATEGORIES} from '../panel/model.js';
const data=prepareData(raw);
test('catalog contains unique emoji and all nine categories',()=>{ assert.ok(data.length>1900);assert.equal(new Set(data.map(e=>e.emoji)).size,data.length);assert.deepEqual([...new Set(data.map(e=>e.group))].sort((a,b)=>a-b),CATEGORIES.map(c=>c.id)); });
test('search handles GitHub shortcodes, tags, multiword queries, and emoji',()=>{
 assert.equal(searchEmoji(data,':+1:')[0].emoji,'👍');assert.equal(searchEmoji(data,':thumbsup:')[0].emoji,'👍');
 assert.equal(searchEmoji(data,':rocket:')[0].emoji,'🚀');assert.ok(searchEmoji(data,'coffee').some(e=>e.emoji==='☕'));
 assert.ok(searchEmoji(data,'red heart').some(e=>e.emoji==='❤️'));assert.equal(searchEmoji(data,'🦊')[0].emoji,'🦊');assert.equal(searchEmoji(data,'zzzznotanemoji').length,0);
});
test('skin tone uses authoritative sequences, keeps unmodifiable emoji intact',()=>{const e=data.find(e=>e.emoji==='👋');assert.equal(glyph(e,3),'👋🏽');assert.equal(glyph(e,0),'👋');assert.equal(glyph(data.find(e=>e.emoji==='🚀'),5),'🚀');});
test('preferences tolerate invalid data, unavailable storage, and oversized history',()=>{
 assert.deepEqual(readPreferences({getItem(){throw Error('blocked')}}),{saved:[],recent:[],tone:0});
 assert.deepEqual(readPreferences({getItem:()=>'{broken'}),{saved:[],recent:[],tone:0});
 assert.deepEqual(readPreferences({getItem:()=>JSON.stringify({saved:[null,42,'😀','😀'],recent:{},tone:999})}),{saved:['😀'],recent:[],tone:0});
 assert.equal(remember(Array.from({length:50},(_,i)=>String(i)),'hello').length,36);assert.deepEqual(remember(['a','b','c'],'b'),['b','a','c']);
});
test('virtual window stays bounded across the entire catalog and catches final row',()=>{
 const {rows,height}=layoutRows(CATEGORIES.map(c=>({title:c.name,items:data.filter(e=>e.group===c.id)})),7);
 for(let y=0;y<height;y+=117){const [start,end]=visibleRows(rows,y,650);assert.ok(end-start<23);assert.ok(rows[start].y<=y);assert.ok(rows[end-1].y+rows[end-1].height>=Math.min(y+650,height));}
 const [,end]=visibleRows(rows,height-650,650);assert.equal(end,rows.length);
});
test('search is fast on the full bundled catalog',()=>{const start=performance.now();for(let i=0;i<200;i++)searchEmoji(data,['heart','coffee','face','rocket','person running'][i%5]);const elapsed=performance.now()-start;assert.ok(elapsed<1000,`200 searches took ${elapsed}ms`);console.log(`200 full-catalog searches: ${elapsed.toFixed(1)}ms`);});
