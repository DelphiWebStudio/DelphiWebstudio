// Run against an isolated Vite browser context. Set WEBSTUDIO_PLAYWRIGHT to the installed Playwright module.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const { createServer } = await import('vite');
const server = process.env.WEBSTUDIO_TEST_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 5187, strictPort: true } });
let browser, context, page;
const errors=[];
const assert=(value,message)=>{if(!value) throw Error(message)};
try {
 await server?.listen();
 browser = await chromium.launch({headless:true,executablePath:process.env.WEBSTUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.WEBSTUDIO_TEST_URL || 'http://127.0.0.1:5187/'));
 await page.evaluate(async()=>{
  const {useProjectsStore:p}=await import('/src/store/projectsStore.ts');
  const {useConfigStore:c}=await import('/src/store/configStore.ts');
  const {useEditorStore:e}=await import('/src/store/editorStore.ts');
  const {buildTemplate}=await import('/src/lib/templates.ts');
  const config=buildTemplate('church','Community Church');
  const id=p.getState().addProject('Interface review'); p.getState().updateProjectConfig(id,config); c.getState().setConfig(config); e.getState().setActiveProject(id);
 });
 await page.getByRole('link',{name:'Editor',exact:true}).click();
 // Active id is session-only, set after navigation load.
 await page.evaluate(async()=>{const {useEditorStore:e}=await import('/src/store/editorStore.ts'); const {useProjectsStore:p}=await import('/src/store/projectsStore.ts');e.getState().setActiveProject(p.getState().projects[0].id)});
 await page.getByRole('menubar').waitFor();
 await page.getByRole('menubar').getByText('View',{exact:true}).click();
 await page.getByRole('menuitem',{name:'Media library',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Project media library'}); await dialog.waitFor();
 await dialog.getByText('Import files and folders',{exact:true}).click();
 await dialog.getByLabel('Duplicate files',{exact:true}).selectOption('keep');
 const png=await page.evaluate(()=>{let c=document.createElement('canvas');c.width=160;c.height=100;let x=c.getContext('2d');x.fillStyle='#1769ca';x.fillRect(0,0,160,100);x.fillStyle='#f28a25';x.fillRect(10,10,50,80);return c.toDataURL('image/png').split(',')[1]});
 await dialog.getByLabel('Import media files',{exact:true}).setInputFiles(Array.from({length:100},(_,i)=>({name:`Photo-${String(i+1).padStart(3,'0')}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
 await page.waitForFunction(async()=>{const{useEditorStore:e}=await import('/src/store/editorStore.ts');const{ProjectMediaLibrary:L}=await import('/src/media/media-library.ts');return !e.getState().mediaImporting&&(await new L().list(e.getState().activeProjectId)).length===100});
 await dialog.getByText('Page 1 of 3',{exact:true}).waitFor();
 assert(await dialog.getByRole('button',{name:/^Select Photo-/}).count()===36,'Media grid should page 36 thumbnails');
 await dialog.getByRole('button',{name:'Next',exact:true}).click();await dialog.getByText('Page 2 of 3',{exact:true}).waitFor();
 await dialog.getByLabel('Search media',{exact:true}).fill('Photo-090');
 await dialog.getByRole('button',{name:'Select Photo-090.png',exact:true}).click();
 await dialog.getByRole('button',{name:'Add to page',exact:true}).click();
 await page.locator('[data-editor-section="1"]').first().click({position:{x:90,y:80}});
 await page.waitForFunction(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');return c.getState().getActivePageBlocks().some(b=>JSON.stringify(b.props).includes('Photo-090.png'))});
 await page.getByRole('menubar').getByText('View',{exact:true}).click();await page.getByRole('menuitem',{name:'Media library',exact:true}).click();
 await dialog.getByLabel('Filter media by type',{exact:true}).selectOption('application/pdf');
 assert(await dialog.getByRole('button',{name:/^Select Photo-/}).count()===0,'PDF filter should hide images');
 await dialog.getByLabel('Filter media by type',{exact:true}).selectOption('all');
 if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') await dialog.screenshot({path:'docs/guide-images/media-library-grid.png'});
 await dialog.getByRole('button',{name:'Close media library'}).click();
 await dialog.waitFor({state:'hidden'}); await page.getByRole('menubar').getByText('Insert',{exact:true}).click(); await page.getByRole('menuitem',{name:'More elements…',exact:true}).click();
 await page.getByRole('button',{name:'Heading 1',exact:true}).click();
 await page.locator('[data-editor-section="1"]').first().click({position:{x:300,y:150}});
 await page.waitForFunction(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');return c.getState().getActivePageBlocks().some(b=>Array.isArray(b.props.section1Objects)&&b.props.section1Objects.some(o=>o.text==='Heading 1'&&o.fontSize===36))});
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{
   const {useConfigStore:c}=await import('/src/store/configStore.ts');const {useEditorStore:e}=await import('/src/store/editorStore.ts');
   const b=c.getState().getActivePageBlocks()[0];const image=b.props.section1Objects.find(o=>o.type==='image');e.getState().selectBlock(b.id);e.getState().selectSectionObject({blockId:b.id,section:1,id:image.id});window.dispatchEvent(new Event('webstudio.properties'));
 });
 if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') await page.getByRole('dialog',{name:'Editor settings'}).screenshot({path:'docs/guide-images/object-properties-professional.png'});
 await page.getByRole('button',{name:/^Browse image for /}).click();
 await dialog.getByRole('button',{name:'Select Photo-001.png',exact:true}).click();
 if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') await dialog.screenshot({path:'docs/guide-images/media-library-search.png'});
 await dialog.getByRole('button',{name:'Choose file',exact:true}).click();
 await page.waitForFunction(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');return c.getState().getActivePageBlocks()[0].props.section1Objects.find(o=>o.type==='image').src.endsWith('Photo-001.png')});
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.evaluate(async()=>{
  const {useConfigStore:c}=await import('/src/store/configStore.ts');const {useEditorStore:e}=await import('/src/store/editorStore.ts');
  const block=c.getState().getActivePageBlocks()[0];
  c.getState().updateBlockProps(block.id,{section1Objects:[{id:'panel-a',type:'panel',text:'Panel',x:10,y:40,width:25,height:150,layer:1},{id:'child-a',parentId:'panel-a',type:'text',text:'Rich child',x:12,y:50,width:20,height:60,layer:2},{id:'other',type:'text',text:'Other text',x:50,y:80,width:30,height:60,layer:3}]});
  // Real rich field names include the complete object id.
  c.getState().updateBlockProps(block.id,{'sectionObject_child-a':'Rich child','sectionObject_child-aRich':[{text:'Rich child',bold:true,color:'#1769ca'}]});
  e.getState().selectBlock(block.id);e.getState().setSectionObjects([{blockId:block.id,section:1,id:'panel-a'},{blockId:block.id,section:1,id:'other'}]);
 });
 await page.getByRole('button',{name:'Left',exact:true}).click();
 await page.evaluate(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');const b=c.getState().getActivePageBlocks()[0];if(b.props.section1Objects.find(o=>o.id==='other').x!==10||b.props.section1Objects.find(o=>o.id==='child-a').x!==12)throw Error('Alignment moved panel children incorrectly')});
 await page.evaluate(async()=>{const{useEditorStore:e}=await import('/src/store/editorStore.ts');const{useConfigStore:c}=await import('/src/store/configStore.ts');e.getState().selectSectionObject({blockId:c.getState().getActivePageBlocks()[0].id,section:1,id:'panel-a'})});
 await page.getByRole('button',{name:'Duplicate',exact:true}).click();
 await page.evaluate(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');const{useEditorStore:e}=await import('/src/store/editorStore.ts');const b=c.getState().getActivePageBlocks()[0], id=e.getState().selectedSectionObject.id,child=b.props.section1Objects.find(o=>o.parentId===id);if(!child||!b.props[`sectionObject_${child.id}Rich`]?.[0].bold)throw Error('Duplicate lost the child or its formatting')});
 await page.getByRole('button',{name:'Bring to front',exact:true}).click();
 await page.evaluate(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');const{useEditorStore:e}=await import('/src/store/editorStore.ts');const items=c.getState().getActivePageBlocks()[0].props.section1Objects,id=e.getState().selectedSectionObject.id;if(items.find(o=>o.parentId===id).layer<=items.find(o=>o.id===id).layer)throw Error('Panel obscured its child')});
 await page.getByRole('button',{name:'Delete',exact:true}).click();
 await page.evaluate(async()=>{const{useConfigStore:c}=await import('/src/store/configStore.ts');const items=c.getState().getActivePageBlocks()[0].props.section1Objects;if(items.length!==3)throw Error('Delete left orphaned children')});
 await page.evaluate(async()=>{
  const{useConfigStore:c}=await import('/src/store/configStore.ts');const{useEditorStore:e}=await import('/src/store/editorStore.ts');const{themePresets}=await import('/src/lib/theme-presets.ts');
  const previous=c.getState().getActivePageBlocks()[0].props.section1Objects;
  c.getState().setConfig({name:'Community project',theme:themePresets.find(t=>t.id==='clean').theme,blocks:[{id:'sample-nav',type:'navbar',variant:'simple',props:{logo:'Community',navItems:[{label:'Home',url:'/'},{label:'Visit',url:'#visit'},{label:'Resources',url:'#resources'}],blockBackgroundColor:'#ffffff'}},{id:'sample-hero',type:'hero',variant:'minimal',props:{headline:'Welcome to our community',subheadline:'A place to meet, share and grow.',primaryCta:'',layoutHeight:220}},{id:'sample-content',type:'content',variant:'prose',props:{body:'',blockBackgroundColor:'#ffffff',sectionCount:2,section1Objects:[{...previous.find(o=>o.id==='panel-a'),text:'Community news',textColor:'#172033',color:'#e8f1fb',x:5,y:25,width:90,height:140},{...previous.find(o=>o.id==='child-a'),text:'Share your latest news here.',textColor:'#172033',x:10,y:70,width:80}],section2Objects:[{id:'sample-text',type:'text',text:'Plan your visit',x:5,y:30,width:85,height:60,layer:1,fontSize:28,textColor:'#172033'},{id:'sample-body',type:'text',text:'Add photos, useful information and links. Each item can be edited independently.',x:5,y:105,width:85,height:100,layer:2,textColor:'#172033'}],sectionObject_child_aRich:[]}}]});e.getState().selectSectionObject(null);e.getState().selectBlock(null);
 });
 if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') { await page.waitForFunction(()=>!document.querySelector('[data-sonner-toast][data-visible="true"]')); await page.screenshot({path:'docs/guide-images/editor-professional.png'}); }

 // Modal remains contained at a small laptop viewport.
 await page.setViewportSize({width:1024,height:700});
 await page.getByRole('menubar').getByText('View',{exact:true}).click();await page.getByRole('menuitem',{name:'Media library',exact:true}).click();
 const bounds=await dialog.boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=700,'Media window is outside viewport');
 await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
 await page.getByRole('link',{name:'Dashboard',exact:true}).click();
 await page.locator('.card-lift').filter({hasText:'Interface review'}).scrollIntoViewIfNeeded();
 await page.locator('[inert][aria-hidden="true"]').filter({hasText:'Welcome to our community'}).waitFor();
 assert(errors.length===0,`Unexpected browser errors: ${errors.join('; ')}`);
 console.log('PASS: 100-image library, pagination/search/type filter, image placement/property picker, text presets, panel alignment/duplicate rich content/layers/delete, viewport fit, Escape.');
} catch(error) { if (page) console.log(await page.locator('body').innerText()); throw error } finally {await context?.close();await browser?.close();await server?.close()}
