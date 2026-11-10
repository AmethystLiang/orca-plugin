import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/panel/index.html');await expect(page.getByRole('gridcell').first()).toBeVisible();});
test('copies the chosen emoji, tracks recent use, and keeps saved emoji across reloads',async({page})=>{
 await page.getByRole('searchbox').fill(':rocket:');await page.getByRole('gridcell',{name:'rocket',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Copied to clipboard'})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('🚀');
 await page.getByRole('button',{name:'Save rocket',exact:true}).click();await page.getByRole('button',{name:'Clear search',exact:true}).click();
 await page.getByRole('button',{name:'Recent',exact:true}).click();await expect(page.getByRole('gridcell',{name:'rocket',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/^Saved/}).click();await expect(page.getByRole('gridcell',{name:'rocket',exact:true})).toBeVisible();
 await page.getByRole('gridcell',{name:'rocket',exact:true}).hover();await page.getByRole('button',{name:'Unsave rocket',exact:true}).click();await expect(page.getByText('Keep your favorites close')).toBeVisible();
});
test('keyboard navigation crosses virtual windows and copies using Enter',async({page})=>{
 const search=page.getByRole('searchbox');await search.fill('coffee');await search.press('ArrowDown');await expect(page.locator(':focus')).toHaveAttribute('role','gridcell');
 await page.keyboard.press('Enter');await expect(page.locator('#toast')).toContainText('Copied');
 await page.getByRole('button',{name:'Clear search',exact:true}).click();await search.press('ArrowDown');
 await page.keyboard.press('Control+End');await expect(page.locator(':focus')).toHaveAttribute('role','gridcell');expect(await page.locator(':focus').getAttribute('data-index')).toBe(await page.getByRole('gridcell').last().getAttribute('data-index'));
 await page.keyboard.press('Control+Home');await expect(page.locator(':focus')).toHaveAttribute('data-index','0');
});
test('skin tones copy the chosen sequence and persist',async({page})=>{
 await page.getByRole('searchbox').fill('waving hand');await page.getByRole('button',{name:'Choose skin tone',exact:true}).click();await page.getByRole('button',{name:'Medium skin tone',exact:true}).click();
 await expect(page.getByRole('gridcell',{name:'waving hand',exact:true})).toHaveText('👋🏽');await page.getByRole('gridcell',{name:'waving hand',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('👋🏽');
 await page.reload();await page.getByRole('searchbox').fill('waving hand');await expect(page.getByRole('gridcell',{name:'waving hand',exact:true})).toHaveText('👋🏽');
});
test('bounded DOM, responsive layout, no external network, and fast searches',async({page})=>{
 const external=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173'))external.push(r.url());});
 for(const y of [0,3000,7000,12000,20000]){await page.locator('#viewport').evaluate((e,y)=>e.scrollTop=y,y);await page.evaluate(()=>new Promise(requestAnimationFrame));expect(await page.getByRole('gridcell').count()).toBeLessThan(160);}
 await page.setViewportSize({width:260,height:600});expect(await page.evaluate(()=>document.body.scrollWidth)).toBe(260);
 const duration=await page.evaluate(async()=>{const input=document.querySelector('#search');const start=performance.now();for(const value of ['heart','coffee','happy','rocket','person','cat','pizza','family','thumbsup','flower']){input.value=value;input.dispatchEvent(new Event('input'));}return performance.now()-start;});
 expect(duration).toBeLessThan(500);console.log(`10 searches + DOM updates: ${duration.toFixed(1)}ms`);expect(external).toEqual([]);
});
test('empty states recover and all category filters work',async({page})=>{
 await page.getByRole('searchbox').fill('no-such-emoji-here');await expect(page.getByText('No emoji found')).toBeVisible();await page.getByRole('button',{name:'Clear search',exact:true}).first().click();
 await page.getByRole('button',{name:'Food & drink',exact:true}).click();await expect(page.getByRole('columnheader',{name:'Food & drink',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Food & drink',exact:true}).click();await page.getByRole('button',{name:'Recent',exact:true}).click();await expect(page.getByText('Your next favorite starts here')).toBeVisible();
});
test('clipboard refusal provides selectable text instead of claiming success',async({page})=>{
 await page.evaluate(()=>{document.execCommand=()=>false;Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('blocked'))},configurable:true});});
 await page.getByRole('searchbox').fill(':rocket:');await page.getByRole('gridcell',{name:'rocket',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('textbox',{name:'Emoji to copy'})).toHaveValue('🚀');
});
test('light and dark themes render without page errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.reload();await page.screenshot({path:'.orca/shots/light.png'});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'.orca/shots/dark.png'});expect(errors).toEqual([]);
});
